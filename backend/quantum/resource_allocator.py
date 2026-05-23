import logging
import uuid
import numpy as np

from qiskit_optimization import QuadraticProgram
from qiskit_optimization.algorithms import MinimumEigenOptimizer
from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA
from qiskit.primitives import StatevectorSampler

from backend.utils.geo import haversine

logging.basicConfig(level=logging.INFO)

RESPONDER_TYPES = {
    "ambulance": {"speed_kmh": 50, "capacity": 4},
    "fire_truck": {"speed_kmh": 40, "capacity": 6},
    "rescue_team": {"speed_kmh": 35, "capacity": 8},
    "police": {"speed_kmh": 55, "capacity": 3},
    "hazmat_unit": {"speed_kmh": 30, "capacity": 5},
    "medical_team": {"speed_kmh": 45, "capacity": 10},
}

DEFAULT_RESPONDERS = [
    {"id": "ambulance_1", "type": "ambulance", "lat": 12.9716, "lng": 77.5946},
    {"id": "ambulance_2", "type": "ambulance", "lat": 12.9352, "lng": 77.6245},
    {"id": "ambulance_3", "type": "ambulance", "lat": 12.9081, "lng": 77.6476},
    {"id": "fire_truck_1", "type": "fire_truck", "lat": 12.9783, "lng": 77.5710},
    {"id": "fire_truck_2", "type": "fire_truck", "lat": 12.9141, "lng": 77.6368},
    {"id": "rescue_team_1", "type": "rescue_team", "lat": 12.9698, "lng": 77.7500},
    {"id": "rescue_team_2", "type": "rescue_team", "lat": 12.9260, "lng": 77.5830},
    {"id": "police_1", "type": "police", "lat": 12.9550, "lng": 77.6070},
    {"id": "police_2", "type": "police", "lat": 12.9400, "lng": 77.5850},
    {"id": "hazmat_unit_1", "type": "hazmat_unit", "lat": 12.9600, "lng": 77.6400},
    {"id": "medical_team_1", "type": "medical_team", "lat": 12.9500, "lng": 77.5900},
]

RESOURCE_MAPPING = {
    "fire": ["fire_truck", "ambulance", "rescue_team"],
    "flood": ["rescue_team", "ambulance", "police"],
    "road_accident": ["ambulance", "police", "rescue_team"],
    "medical_emergency": ["ambulance", "medical_team"],
    "power_outage": ["police", "rescue_team"],
    "infrastructure_failure": ["rescue_team", "fire_truck", "ambulance"],
    "crowd_risk": ["police", "ambulance", "medical_team"],
    "hazardous_material": ["hazmat_unit", "fire_truck", "ambulance"],
    "rescue_required": ["rescue_team", "ambulance", "fire_truck"],
    "other": ["police", "ambulance"],
}


def compute_priority(cluster: dict) -> float:
    """Compute priority score for a cluster."""
    severity = cluster.get("cluster_severity", 0.0)
    escalation = cluster.get("escalation_probability", 0.0)
    people = cluster.get("incident_count", 1)

    normalized_people = min(people / 20.0, 1.0)

    priority = severity * 0.5 + escalation * 0.3 + normalized_people * 0.2
    return round(priority, 4)


def build_distance_matrix(
    responders: list[dict], clusters: list[dict]
) -> np.ndarray:
    """Build simulated distance matrix (km) between responders and cluster centroids."""
    n_resp = len(responders)
    n_clust = len(clusters)
    matrix = np.zeros((n_resp, n_clust))

    for i, resp in enumerate(responders):
        for j, cluster in enumerate(clusters):
            clat = cluster.get("centroid_lat", 12.9716)
            clng = cluster.get("centroid_lng", 77.5946)
            dist = haversine(resp["lat"], resp["lng"], clat, clng)
            matrix[i][j] = dist

    return matrix


def compute_eta(distance_km: float, responder_type: str) -> float:
    """Compute estimated time of arrival in minutes."""
    speed = RESPONDER_TYPES.get(responder_type, {"speed_kmh": 40})["speed_kmh"]
    return round((distance_km / speed) * 60, 1)


def allocate_resources_quantum(
    clusters: list[dict],
    responders: list[dict] = None,
    use_quantum: bool = True,
) -> list[dict]:
    """
    Allocate emergency responders to incident clusters using QAOA.

    Uses Qiskit QuadraticProgram with QAOA for optimization.
    Falls back to classical greedy if quantum fails.
    """
    if responders is None:
        responders = DEFAULT_RESPONDERS

    if not clusters:
        return []

    n_resp = len(responders)
    n_clust = len(clusters)

    dist_matrix = build_distance_matrix(responders, clusters)
    priorities = [compute_priority(c) for c in clusters]

    needed_types = {}
    for j, cluster in enumerate(clusters):
        itype = cluster.get("incident_type", "other")
        needed_types[j] = RESOURCE_MAPPING.get(itype, ["police", "ambulance"])

    if use_quantum and n_resp <= 12 and n_clust <= 6:
        try:
            allocations = _quantum_optimize(
                responders, clusters, dist_matrix, priorities, needed_types
            )
            logging.info("Quantum optimization (QAOA) succeeded")
            return allocations
        except Exception as e:
            logging.warning(f"Quantum optimization failed, falling back to classical: {e}")

    return _classical_greedy(responders, clusters, dist_matrix, priorities, needed_types)


def _quantum_optimize(
    responders: list[dict],
    clusters: list[dict],
    dist_matrix: np.ndarray,
    priorities: list[float],
    needed_types: dict,
) -> list[dict]:
    """QAOA-based optimization for resource allocation."""
    n_resp = len(responders)
    n_clust = len(clusters)

    qp = QuadraticProgram("emergency_allocation")

    for i in range(n_resp):
        for j in range(n_clust):
            qp.binary_var(f"x_{i}_{j}")

    linear = {}
    for i in range(n_resp):
        for j in range(n_clust):
            var_name = f"x_{i}_{j}"
            distance_cost = dist_matrix[i][j]
            priority_weight = priorities[j]
            type_match = 1.0 if responders[i]["type"] in needed_types.get(j, []) else 3.0
            linear[var_name] = distance_cost * type_match - priority_weight * 10

    qp.minimize(linear=linear)

    for i in range(n_resp):
        constraint = {f"x_{i}_{j}": 1 for j in range(n_clust)}
        qp.linear_constraint(linear=constraint, sense="<=", rhs=1, name=f"resp_{i}")

    sampler = StatevectorSampler()
    qaoa = QAOA(sampler=sampler, optimizer=COBYLA(maxiter=100), reps=2)
    optimizer = MinimumEigenOptimizer(qaoa)
    result = optimizer.solve(qp)

    allocations = []
    for i in range(n_resp):
        for j in range(n_clust):
            var_name = f"x_{i}_{j}"
            idx = [v.name for v in qp.variables].index(var_name)
            if result.x[idx] > 0.5:
                dist = dist_matrix[i][j]
                eta = compute_eta(dist, responders[i]["type"])
                allocations.append({
                    "allocation_id": str(uuid.uuid4()),
                    "responder_id": responders[i]["id"],
                    "responder_type": responders[i]["type"],
                    "assigned_cluster": clusters[j].get("cluster_id", f"cluster_{j}"),
                    "cluster_incident_type": clusters[j].get("incident_type", "other"),
                    "distance_km": round(dist, 2),
                    "eta_minutes": eta,
                    "priority_score": priorities[j],
                    "optimization_method": "QAOA",
                })

    return allocations


def _classical_greedy(
    responders: list[dict],
    clusters: list[dict],
    dist_matrix: np.ndarray,
    priorities: list[float],
    needed_types: dict,
) -> list[dict]:
    """Classical greedy fallback allocation."""
    allocations = []
    assigned_responders = set()

    sorted_clusters = sorted(
        enumerate(clusters), key=lambda x: priorities[x[0]], reverse=True
    )

    for j, cluster in sorted_clusters:
        needed = needed_types.get(j, ["police", "ambulance"])

        for rtype in needed:
            best_i = None
            best_dist = float("inf")

            for i, resp in enumerate(responders):
                if i in assigned_responders:
                    continue
                if resp["type"] != rtype:
                    continue
                if dist_matrix[i][j] < best_dist:
                    best_dist = dist_matrix[i][j]
                    best_i = i

            if best_i is not None:
                assigned_responders.add(best_i)
                eta = compute_eta(best_dist, responders[best_i]["type"])
                allocations.append({
                    "allocation_id": str(uuid.uuid4()),
                    "responder_id": responders[best_i]["id"],
                    "responder_type": responders[best_i]["type"],
                    "assigned_cluster": cluster.get("cluster_id", f"cluster_{j}"),
                    "cluster_incident_type": cluster.get("incident_type", "other"),
                    "distance_km": round(best_dist, 2),
                    "eta_minutes": eta,
                    "priority_score": priorities[j],
                    "optimization_method": "classical_greedy",
                })

    return allocations


if __name__ == "__main__":
    import json

    test_clusters = [
        {
            "cluster_id": "flood_cluster_1",
            "incident_type": "flood",
            "cluster_severity": 0.88,
            "escalation_probability": 0.76,
            "incident_count": 8,
            "centroid_lat": 12.9127,
            "centroid_lng": 77.6228,
        },
        {
            "cluster_id": "fire_cluster_1",
            "incident_type": "fire",
            "cluster_severity": 0.92,
            "escalation_probability": 0.65,
            "incident_count": 3,
            "centroid_lat": 12.9352,
            "centroid_lng": 77.6245,
        },
    ]
    result = allocate_resources_quantum(test_clusters)
    print(json.dumps(result, indent=2, default=str))
