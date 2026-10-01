import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.schemas import (
    PredictRequest,
    PredictResponse,
    Topic,
    TopicCreateRequest,
    TopicMemoryResponse,
    HealthResponse,
)
from app.models.classifier import DebertaClassifier
from app.models.embeddings import SemanticEmbeddingEngine
from app.services.topic_memory import TopicMemoryService
from app.services.hybrid_decision import HybridDecisionEngine
from app.services.prediction import PredictionPipeline

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("contextflow")

# Global pipeline instances initialized once at startup
classifier: DebertaClassifier = None
embedding_engine: SemanticEmbeddingEngine = None
topic_memory: TopicMemoryService = None
hybrid_engine: HybridDecisionEngine = None
pipeline: PredictionPipeline = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global classifier, embedding_engine, topic_memory, hybrid_engine, pipeline
    logger.info("Starting ContextFlow CPU Backend...")

    resolved_model_path = settings.get_resolved_model_path()
    logger.info(f"Loading DeBERTa model from: {resolved_model_path} (Device: {settings.DEVICE})")
    
    classifier = DebertaClassifier(model_path=resolved_model_path)
    try:
        classifier.load()
        logger.info("DeBERTa-v3-base sequence classifier loaded successfully on CPU.")
    except Exception as e:
        logger.error(f"Failed to load DeBERTa weights: {e}")
        raise RuntimeError(f"Could not load DeBERTa model from {resolved_model_path}: {e}")

    logger.info(f"Loading Sentence-Transformer MiniLM ({settings.EMBEDDING_MODEL}) on CPU...")
    embedding_engine = SemanticEmbeddingEngine(model_name=settings.EMBEDDING_MODEL)
    try:
        embedding_engine.load()
        logger.info("MiniLM semantic embedding engine loaded successfully on CPU.")
    except Exception as e:
        logger.error(f"Failed to load MiniLM embedding engine: {e}")
        raise RuntimeError(f"Could not load MiniLM: {e}")

    topic_memory = TopicMemoryService(embedding_engine=embedding_engine)
    topic_memory.reset_with_defaults()

    hybrid_engine = HybridDecisionEngine(
        default_threshold=settings.CONTINUATION_SIMILARITY_THRESHOLD
    )

    pipeline = PredictionPipeline(
        classifier=classifier,
        embedding_engine=embedding_engine,
        hybrid_engine=hybrid_engine
    )

    logger.info("ContextFlow pipeline is ready to accept requests.")
    yield
    logger.info("Shutting down ContextFlow backend.")

app = FastAPI(
    title="ContextFlow API",
    description="Conversation Transition Detection & Context Management System (CPU Inference)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        device="cpu",
        transformer_loaded=classifier.is_loaded if classifier else False,
        embedding_loaded=embedding_engine.is_loaded if embedding_engine else False,
        transformer_model="microsoft/deberta-v3-base (fine-tuned)",
        embedding_model=settings.EMBEDDING_MODEL
    )

@app.post("/predict", response_model=PredictResponse)
async def predict_transition(request: PredictRequest):
    if not request.current_message or not request.current_message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="current_message must not be empty or whitespace."
        )

    if not request.active_topic or not request.active_topic.summary.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="active_topic with a valid summary is required."
        )

    try:
        result = pipeline.predict(request)
        return result
    except Exception as e:
        logger.error(f"Prediction inference error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference failure: {str(e)}"
        )

@app.get("/topics", response_model=TopicMemoryResponse)
async def get_topics():
    if not topic_memory:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Topic memory service not ready."
        )
    return TopicMemoryResponse(
        active_topic=topic_memory.get_active_topic(),
        previous_topics=topic_memory.get_previous_topics(),
        total_stored=len(topic_memory.topics)
    )

@app.post("/topics", response_model=Topic)
async def create_topic(request: TopicCreateRequest):
    if not request.topic_id or not request.summary:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="topic_id and summary must both be provided."
        )
    return topic_memory.add_topic(request.topic_id, request.summary)

@app.post("/topics/reset", response_model=TopicMemoryResponse)
async def reset_topics():
    topic_memory.reset_with_defaults()
    return TopicMemoryResponse(
        active_topic=topic_memory.get_active_topic(),
        previous_topics=topic_memory.get_previous_topics(),
        total_stored=len(topic_memory.topics)
    )

# Static file serving for Vanilla Frontend
frontend_dirs = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend")),
    os.path.abspath("frontend"),
]

for fdir in frontend_dirs:
    if os.path.exists(fdir) and os.path.isdir(fdir):
        @app.get("/")
        async def serve_index():
            index_path = os.path.join(fdir, "index.html")
            if os.path.exists(index_path):
                return FileResponse(index_path)
            return {"message": "ContextFlow API running. Access /docs for Swagger UI."}

        @app.get("/style.css")
        async def serve_css():
            return FileResponse(os.path.join(fdir, "style.css"), media_type="text/css")

        @app.get("/visualization.js")
        async def serve_viz():
            return FileResponse(os.path.join(fdir, "visualization.js"), media_type="application/javascript")

        @app.get("/app.js")
        async def serve_js():
            return FileResponse(os.path.join(fdir, "app.js"), media_type="application/javascript")

        app.mount("/static", StaticFiles(directory=fdir), name="static")
        break
