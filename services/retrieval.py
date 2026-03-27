from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

def build_vector_store(text: str):
    """
    Chunks transcript and stores in FAISS vector store
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=400,
        chunk_overlap=50,
        length_function=len,
    )
    chunks = text_splitter.split_text(text)
    
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    vector_store = FAISS.from_texts(chunks, embeddings)
    
    return vector_store

def retrieve_relevant_chunks(vector_store, agenda_items: list) -> str:
    """
    Retrieve top-k chunks per agenda item
    """
    retrieved_text = ""
    for item in agenda_items:
        docs = vector_store.similarity_search(item, k=3)
        retrieved_text += f"\n--- Context for: {item} ---\n"
        for doc in docs:
            retrieved_text += doc.page_content + "\n"
            
    return retrieved_text
