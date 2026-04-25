from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.search import RAGSearch

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

class FileIngest(BaseModel):
    filePath: str

# ✅ Health check
@app.get("/")
def root():
    return {"message": "RAG API running 🚀"}

# ✅ Query endpoint
@app.post("/query")
def query_rag(q: Query):
    try:
        answer = rag.search_and_summarize(q.question)

        print("QUESTION:", q.question)
        print("ANSWER:", answer)

        return {
            "answer": answer if answer else "No response generated"
        }

    except Exception as e:
        print("❌ QUERY ERROR:", str(e))
        return {"answer": "AI failed to respond"}

# ✅ Ingest endpoint
@app.post("/ingest")
def ingest(data: FileIngest):
    try:
        result = rag.ingest_file(data.filePath)
        return result
    except Exception as e:
        print("❌ INGEST ERROR:", str(e))
        return {"error": str(e)}