from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse   # ✅ ADD THIS
from pydantic import BaseModel

from src.search import RAGSearch
def get_rag(user_id):
    return RAGSearch(user_id=user_id)

app = FastAPI()

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Initialize RAG once
rag = RAGSearch()

# ✅ Models
class Query(BaseModel):
    question: str
    userId: str

class FileIngest(BaseModel):
    filePath: str
    userId: str

# ✅ Health check
@app.get("/")
def root():
    return {"message": "RAG API running 🚀"}

# ✅ Query endpoint
@app.post("/query")
def query_rag(q: Query):
    try:
        rag = RAGSearch(user_id=q.userId)

        stream = rag.search_and_summarize(q.question)

        return StreamingResponse(stream, media_type="text/plain")

    except Exception as e:
        print("❌ QUERY ERROR:", str(e))
        return StreamingResponse(
            iter(["AI failed to respond"]),
            media_type="text/plain"
        )
# ✅ Ingest endpoint
@app.post("/ingest")
def ingest(data: FileIngest):
    try:
        rag = RAGSearch(user_id=data.userId)
        return rag.ingest_file(data.filePath)
    except Exception as e:
        print("❌ INGEST ERROR:", str(e))
        return {"error": str(e)}