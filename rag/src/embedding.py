from typing import List, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import numpy as np

class EmbeddingPipeline:
    def __init__(self,model_name="all-MiniLM-L6-v2",chunk_size=1000,chunk_overlap=200):
        ### Chunk size is the maximum length of each chunk, and chunk overlap is the number of characters that will overlap between consecutive chunks. This helps to maintain context across chunks when splitting larger documents.
        self.chunk_size=chunk_size
        self.chunk_overlap=chunk_overlap
        ### model is used to convert text to vectors. SentenceTransformer is a popular library for generating sentence embeddings, and "all-MiniLM-L6-v2" is a specific pre-trained model that provides good performance for many tasks.
        self.model=SentenceTransformer(model_name)
        #print(f"Info Loaded:{model_name}")

    def chunk_documents(self,documents:List[Any])->List[Any]:
        ### This function gets a list of documents and splits them into smaller chunks using the RecursiveCharacterTextSplitter. The resulting chunks are returned as a list. Each chunk will have a maximum length defined by chunk_size, and there will be an overlap of characters between consecutive chunks as defined by chunk_overlap.
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""])
        chunks=splitter.split_documents(documents)
        return chunks
    def embed_chunks(self,chunks:List[Any])->np.ndarray:
        ### This function gets a list of chunks and converts them into embeddings using the SentenceTransformer model. The resulting embeddings are returned as a NumPy array.

        ### All the page contents are put into a list called texts.

        texts=[chunk.page_content for chunk in chunks]

        

        ###  Encode function converts the list of texts into their corresponding vector representations (embeddings) using the pre-trained model. The show_progress_bar=True argument displays a progress bar during the encoding process, which can be helpful for tracking the progress when processing a large number of chunks.
        embeddings=self.model.encode(texts,show_progress_bar=True)

        
        return embeddings