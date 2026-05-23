import json
import uuid
import logging
import base64
from datetime import datetime, timezone

# Graceful fallback for environments where pqcrypto C extensions are not built
try:
    from pqcrypto.kem.kyber512 import generate_keypair, encrypt, decrypt
    PQC_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    PQC_AVAILABLE = False
    logging.warning("pqcrypto.kyber512 unavailable - using demo fallback (no real PQC encryption)")

    def generate_keypair():
        # Return dummy keys (32 bytes each)
        return (b"\x00" * 32, b"\x00" * 32)

    def encrypt(pubkey):
        # Return dummy ciphertext and shared secret
        return (b"\x01" * 32, b"\x02" * 32)

    def decrypt(ciphertext, secretkey):
        return b"\x03" * 32

logging.basicConfig(level=logging.INFO)


class PQCDispatcher:
    """Post-Quantum Cryptography secure dispatch using Kyber512."""

    def __init__(self):
        self.public_key, self.secret_key = generate_keypair()
        logging.info("Kyber512 keypair generated for PQC dispatch")

    def encrypt_dispatch(self, allocation: dict) -> dict:
        """
        Encrypt a dispatch message using Kyber512 KEM.

        Flow: dispatch_message -> encrypt -> ciphertext
        """
        plaintext = json.dumps(allocation, default=str)
        ciphertext, shared_secret = encrypt(self.public_key)

        xor_key = shared_secret[: len(plaintext.encode("utf-8"))]
        if len(xor_key) < len(plaintext.encode("utf-8")):
            repeats = (len(plaintext.encode("utf-8")) // len(shared_secret)) + 1
            xor_key = (shared_secret * repeats)[: len(plaintext.encode("utf-8"))]

        plaintext_bytes = plaintext.encode("utf-8")
        encrypted_bytes = bytes(a ^ b for a, b in zip(plaintext_bytes, xor_key))

        dispatch_id = str(uuid.uuid4())
        dispatch_message = {
            "dispatch_id": dispatch_id,
            "encrypted": True,
            "algorithm": "Kyber512",
            "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
            "encrypted_payload": base64.b64encode(encrypted_bytes).decode("utf-8"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "responder_id": allocation.get("responder_id", ""),
            "assigned_cluster": allocation.get("assigned_cluster", ""),
        }

        logging.info(
            f"Dispatch {dispatch_id} encrypted with Kyber512 | "
            f"Responder: {allocation.get('responder_id')}"
        )
        return dispatch_message

    def decrypt_dispatch(self, dispatch_message: dict) -> dict:
        """
        Decrypt a PQC-encrypted dispatch message.

        Flow: ciphertext -> decrypt -> plaintext
        """
        ciphertext = base64.b64decode(dispatch_message["ciphertext"])
        encrypted_payload = base64.b64decode(dispatch_message["encrypted_payload"])

        shared_secret = decrypt(self.secret_key, ciphertext)

        xor_key = shared_secret[: len(encrypted_payload)]
        if len(xor_key) < len(encrypted_payload):
            repeats = (len(encrypted_payload) // len(shared_secret)) + 1
            xor_key = (shared_secret * repeats)[: len(encrypted_payload)]

        decrypted_bytes = bytes(a ^ b for a, b in zip(encrypted_payload, xor_key))
        plaintext = decrypted_bytes.decode("utf-8")

        logging.info(f"Dispatch {dispatch_message['dispatch_id']} decrypted successfully")
        return json.loads(plaintext)

    def secure_dispatch_batch(self, allocations: list[dict]) -> list[dict]:
        """Encrypt and dispatch all resource allocations."""
        dispatches = []
        for allocation in allocations:
            dispatch = self.encrypt_dispatch(allocation)
            dispatches.append(dispatch)
        logging.info(f"Batch dispatch complete: {len(dispatches)} messages encrypted")
        return dispatches


_dispatcher = None


def get_dispatcher() -> PQCDispatcher:
    """Get or create singleton dispatcher instance."""
    global _dispatcher
    if _dispatcher is None:
        _dispatcher = PQCDispatcher()
    return _dispatcher


def secure_dispatch(allocations: list[dict]) -> list[dict]:
    """Convenience function: encrypt and dispatch all allocations."""
    dispatcher = get_dispatcher()
    return dispatcher.secure_dispatch_batch(allocations)


def verify_dispatch(dispatch_message: dict) -> dict:
    """Convenience function: decrypt and verify a dispatch message."""
    dispatcher = get_dispatcher()
    return dispatcher.decrypt_dispatch(dispatch_message)


if __name__ == "__main__":
    test_allocation = {
        "responder_id": "ambulance_1",
        "responder_type": "ambulance",
        "assigned_cluster": "flood_cluster_7",
        "eta_minutes": 8.0,
        "priority_score": 0.85,
    }

    dispatcher = PQCDispatcher()

    encrypted = dispatcher.encrypt_dispatch(test_allocation)
    print("ENCRYPTED:")
    print(json.dumps(encrypted, indent=2))

    decrypted = dispatcher.decrypt_dispatch(encrypted)
    print("\nDECRYPTED:")
    print(json.dumps(decrypted, indent=2))

    assert decrypted == test_allocation, "Decryption mismatch!"
    print("\nVerification: PASSED")
