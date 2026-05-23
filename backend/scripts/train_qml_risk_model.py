from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pennylane as qml
from pennylane import numpy as pnp


TRAIN_PATH = Path("backend/data/processed/qml_training_data.csv")
OUT_PATH = Path("backend/quantum/qml_weights.npy")

N_QUBITS = 4
N_LAYERS = 2
OUTPUT_WEIGHTS = np.array([0.35, 0.30, 0.20, 0.15])  # must match predictor

dev = qml.device("default.qubit", wires=N_QUBITS)


@qml.qnode(dev)
def circuit(features, weights):
    """MUST be identical to quantum_circuit() in qml_incident_predictor.py"""
    qml.AngleEmbedding(features, wires=range(N_QUBITS))
    qml.StronglyEntanglingLayers(weights, wires=range(N_QUBITS))
    return [qml.expval(qml.PauliZ(i)) for i in range(N_QUBITS)]


def predict_prob(features, weights):
    expectations = pnp.array(circuit(features, weights))
    normalized = (1 - expectations) / 2.0
    return float(pnp.clip(pnp.dot(pnp.array(OUTPUT_WEIGHTS), normalized), 0.0, 1.0))


def binary_cross_entropy(y_true, y_pred, eps=1e-7):
    y_pred = pnp.clip(y_pred, eps, 1 - eps)
    return -(y_true * pnp.log(y_pred) + (1 - y_true) * pnp.log(1 - y_pred))


def loss_fn(weights, X, y):
    eps = 1e-7
    losses = []
    for xi, yi in zip(X, y):
        p = predict_prob(xi, weights)
        p = float(np.clip(p, eps, 1 - eps))
        losses.append(-(yi * np.log(p) + (1 - yi) * np.log(1 - p)))
    return pnp.mean(pnp.array(losses))


def accuracy(weights, X, y):
    preds = np.array([float(predict_prob(x, weights)) for x in X])
    y_hat = (preds >= 0.5).astype(int)
    return (y_hat == np.array(y)).mean()


def main():
    print("\n=== Training QML Risk Model ===")
    if not TRAIN_PATH.exists():
        raise FileNotFoundError(
            f"Missing {TRAIN_PATH}. Run build_crash_training_data.py first."
        )

    df = pd.read_csv(TRAIN_PATH)

    # Filter out "Total" rows that are aggregates, not real areas
    df = df[~df["area"].str.contains("Total", case=False, na=False)]

    X = df[
        [
            "severity_score",
            "historical_area_risk",
            "report_density",
            "accessibility_risk",
        ]
    ].values.astype(float)

    y = df["risk_label_binary"].values.astype(float)

    rng = np.random.default_rng(42)
    idx = rng.permutation(len(X))
    X, y = X[idx], y[idx]

    # Keep training small enough for hackathon runtime.
    X = X[:300]
    y = y[:300]

    split = int(0.8 * len(X))
    X_train = pnp.array(X[:split], requires_grad=False)
    y_train = pnp.array(y[:split], requires_grad=False)
    X_test = pnp.array(X[split:], requires_grad=False)
    y_test = pnp.array(y[split:], requires_grad=False)

    # Normalize features to [0, pi] before training, same as inference
    X_train = X_train * np.pi
    X_test = X_test * np.pi

    weights = pnp.array(
        rng.normal(0, 0.1, size=(N_LAYERS, N_QUBITS, 3)),
        requires_grad=True,
    )

    opt = qml.AdamOptimizer(stepsize=0.05)

    print(f"Training on {len(X_train)} samples, testing on {len(X_test)} samples")
    for epoch in range(60):
        weights = opt.step(lambda w: loss_fn(w, X_train, y_train), weights)

        if epoch % 10 == 0 or epoch == 59:
            train_loss = float(loss_fn(weights, X_train, y_train))
            train_acc = accuracy(weights, X_train, y_train)
            test_acc = accuracy(weights, X_test, y_test)
            print(
                f"epoch={epoch:02d} "
                f"loss={train_loss:.4f} "
                f"train_acc={train_acc:.3f} "
                f"test_acc={test_acc:.3f}"
            )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    np.save(OUT_PATH, np.array(weights))
    print(f"\nSaved trained QML weights → {OUT_PATH}")
    print("Reloading and verifying...")
    loaded = np.load(OUT_PATH)
    assert loaded.shape == (N_LAYERS, N_QUBITS, 3), "Shape mismatch — training bug"
    print("Verification: PASSED")
    print(f"\n✅ Training complete! Test accuracy: {test_acc:.3f}")


if __name__ == "__main__":
    main()
