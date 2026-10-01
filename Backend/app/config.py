import os
from pydantic import BaseModel
from typing import List

class Settings(BaseModel):
    # Model settings
    MODEL_PATH: str = os.getenv(
        "MODEL_PATH",
        os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "deberta_v3_contextflow")
        )
    )
    # Alternative path if run inside docker or backend folder
    FALLBACK_MODEL_PATH: str = os.getenv(
        "FALLBACK_MODEL_PATH",
        os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "model", "deberta_v3_contextflow")
        )
    )
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    
    # Hybrid Decision Settings
    CONTINUATION_SIMILARITY_THRESHOLD: float = float(
        os.getenv("CONTINUATION_SIMILARITY_THRESHOLD", "0.20")
    )
    
    # Device - Strictly CPU
    DEVICE: str = "cpu"
    
    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: List[str] = ["*"]
    
    def get_resolved_model_path(self) -> str:
        """Find the existing path for DeBERTa model weights."""
        if os.path.exists(self.MODEL_PATH) and os.path.exists(os.path.join(self.MODEL_PATH, "config.json")):
            return self.MODEL_PATH
        if os.path.exists(self.FALLBACK_MODEL_PATH) and os.path.exists(os.path.join(self.FALLBACK_MODEL_PATH, "config.json")):
            return self.FALLBACK_MODEL_PATH
        # Also check relative to working directory
        cwd_model = os.path.abspath("model/deberta_v3_contextflow")
        if os.path.exists(cwd_model) and os.path.exists(os.path.join(cwd_model, "config.json")):
            return cwd_model
        root_model = os.path.abspath("deberta_v3_contextflow")
        if os.path.exists(root_model) and os.path.exists(os.path.join(root_model, "config.json")):
            return root_model
        return self.MODEL_PATH

settings = Settings()
