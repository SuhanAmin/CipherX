import os
import faiss
import numpy as np
import pickle
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
from src.embedding import EmbeddingPipeline

class FaissVectorStore:
    def __init__(self, persist_dir: str='faiss_store',embedding_model: str='all-MiniLM-L6-v2',chunk_size=1000,chunk_overlap=200):
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        self.index=None
        self.metadata=[]
        self.embedding_model = embedding_model
        self.model=SentenceTransformer(embedding_model)
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    def build_from_documents(self,documents:List[Any]):
        if not documents:
            print("No documents provided to build vector store.")
            if self.index is None:
                dim = self.model.get_sentence_embedding_dimension()
                self.index = faiss.IndexFlatL2(dim)
            self.save()
            return
        
        ### Calling Embedding Pipeline to chunk and embed the documents. The chunking and embedding are done in the same function for efficiency. The chunk size and overlap can be adjusted based on the specific use case and document structure.

        emb_pipe=EmbeddingPipeline(model_name=self.embedding_model,chunk_size=self.chunk_size,chunk_overlap=self.chunk_overlap)
        
        ### Making chunks.
        
        chunks=emb_pipe.chunk_documents(documents)

        ### Embedding the chunks.

        embeddings=emb_pipe.embed_chunks(chunks)

        ### Adding metadata[text] = chunkspage_content for each chunk in chunks.

        metadata=[{"text":chunk.page_content} for chunk in chunks]

        ### Calling add_embeddings function to add the embeddings and metadata to the Faiss index. The embeddings are converted to a numpy array of type float32, which is the required format for Faiss. The metadata is stored in a list, and each entry corresponds to the respective embedding.

        self.add_embeddings(np.array(embeddings).astype('float32'),metadata)

        ### embedding and metadata added to Vector data base with index.

        ### Saving the Faiss index in faiss db and metadata in pickle format in faiss_store. 
        self.save()

        ### Faiss index saved in faiss.index and metadata in metadata.pkl in faiss_store folder.

        print("Vector Store Built Successfully  ")
    def add_documents(self, documents):
        from src.embedding import EmbeddingPipeline

        emb_pipe = EmbeddingPipeline(
            model_name=self.embedding_model,
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap
        )

        chunks = emb_pipe.chunk_documents(documents)
        embeddings = emb_pipe.embed_chunks(chunks)

        metadata = [{"text": chunk.page_content} for chunk in chunks]

        self.add_embeddings(
            embeddings.astype('float32'),
            metadata
        )

        self.save()

        print("✅ New file embedded into vector store")
    def add_embeddings(self,embeddings:np.ndarray,metadatas:List[Dict[str,Any]]):
        ### Here embedding is a numpy array of type float32. Eg.[[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], ...]. 
        ### Each Row is a chunk in chunks having dimension of 384 from the embeding model 'all-MiniLM-L6-v2'.

        ### shape is a tuple with (number of chunks, dimension of embedding). eg (5,384).
        ### shape[1] gives dimension ie 384.

        dim=embeddings.shape[1]

        ### For the 1st time index is none. Hence faiss database creates a new index with dimension of embedding ie(dim). 
        ### Eg creating a shelf size for the 384 books.

        if self.index is None:
            self.index=faiss.IndexFlatL2(dim)

        ### After crating index for 1st call and from 2nd call onwards:
        ### The new embeddings are added to the existing index using the add method. This allows for incremental updates to the vector store without needing to rebuild the entire index from scratch.

        ### indexes are used for searching. However for each value out of 384 dimensions .
        ### During search, the nearest neighbors are found based on the distance in the embedding space, and the corresponding metadata can be retrieved using the stored metadata list.

        self.index.add(embeddings)
        

        ### for each index or embedding , also add the metadata to the metadata list.
        if metadatas:
            self.metadata.extend(metadatas)
        ### self.metadata contains the list of metadatas which is page_content of chunk for all the chunks in the vector store. Each entry in self.metadata corresponds to the respective embedding in the Faiss index, allowing for efficient retrieval of metadata during search operations.

        print("Added")
    def save(self):
        ### Saving the Faiss index in faiss db and metadata in pickle format in faiss_store.

        ### faiss_path is the path where faiss index is stores ie the embeddings in vector format.
        ### persisst_dir is the folder where the faiss index and metadata are stored. Eg. faiss_store/faiss.index
       

        faiss_path=os.path.join(self.persist_dir,'faiss.index')

        ### meta_path is the path where metadata is stored in pickle format. Eg. faiss_store/metadata.pkl

        meta_path=os.path.join(self.persist_dir,'metadata.pkl')

        ### faiss.write_index writes the faiss index to the faiss_path.
        faiss.write_index(self.index,faiss_path)

        ### with open is used to do write in binary (wb) mode to meta_path.
        with open(meta_path,'wb') as f:
            ### In pickle format , dump the metadata to meta_path. This allows for efficient storage and retrieval of metadata associated with the embeddings in the Faiss index.
            pickle.dump(self.metadata,f)
        
    def load(self):
        ### Loading the Faiss index and metadata from faiss_store.

        ### faiss_path is the path where faiss index is stores ie the embeddings in vector format.
        ### persisst_dir is the folder where the faiss index and metadata are stored. Eg. faiss_store/faiss.index
       
        faiss_path=os.path.join(self.persist_dir,'faiss.index')
        meta_path=os.path.join(self.persist_dir,'metadata.pkl')

        ### faiss.read_index reads the faiss index from the faiss_path.

        self.index=faiss.read_index(faiss_path)

        ### with open is used to do read in binary (rb) mode from meta_path.

        with open(meta_path,'rb') as f:

            ### In pickle format , load the metadata from meta_path.

            self.metadata=pickle.load(f)
    def search(self,query_embedding:np.ndarray,top_k:int=5):

        ### query_embedding is a numpy array of type float32. Eg. [[0.1, 0.2, 0.3, ..., 0.384]].
        ### Based on the query_embedding, the search function retrieves the indices of the nearest neighbors from the Faiss index using the search method. 
        ### Distances (D) and indices (I) of the top_k nearest neighbors are returned. The metadata corresponding to the retrieved indices is also included in the results for each retrieved chunk, allowing for efficient retrieval of relevant information based on the query. 
        ### The results are returned as a list of dictionaries, where each dictionary contains the index, distance, and metadata for a retrieved chunk.

        D, I = self.index.search(query_embedding, top_k)

        ### D contains list of distances of the nearest neighbors, and I contains the indices of the nearest neighbors in the Faiss index. 
        
        #all_results = []

        ### If there are multiple queries then 1st query of D[0] with nearest top_k neighbors in I[0] and so on for other queries. Hence loop over the length of I which is the number of queries.


        #for query_idx in range(len(I)):   # loop over queries
        results = []
        ### Extracting index and Distance of nearest neighbors and zip merges I and D together.

        for idx, dist in zip(I[0], D[0]):
            ### Adding metadata of each neighbor index to meta.
            meta = self.metadata[idx] if 0 <= idx < len(self.metadata) else None

            ### Adding index, distance and metadata inside results.
            results.append({
                "index": idx,
                "distance": dist,
                "metadata": meta
            })
            ### adding result of multiple queries in all_results
            
            #all_results.append(results)

        return results
    def query(self,query:str,top_k:int=5):
        ### In order to search query from vector db we need to convert the query into embeddings.

        query_emb=self.model.encode([query]).astype('float32')

        ### Calling the search function to serach for embedded query in the Faiss index and return the top_k most similar chunks along with their metadata. 
        ### The search function retrieves the indices of the nearest neighbors based on the distance in the embedding space, and the corresponding metadata is included in the results for each retrieved chunk.

        return self.search(query_emb,top_k)