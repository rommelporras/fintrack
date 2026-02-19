from app.tasks.celery import celery_app
from app.core.logging import log


@celery_app.task(bind=True, max_retries=3)
def process_document(self, document_id: str) -> dict:
    """OCR/PDF parsing — implemented in Phase 2."""
    log.info("process_document.placeholder", document_id=document_id)
    return {"status": "placeholder", "document_id": document_id}
