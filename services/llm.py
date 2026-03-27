from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
import json
import re

def generate_structured_mom(transcript: str, agenda: str) -> dict:
    """
    Uses ChatGroq to generate a structured meeting summary strictly based on the entire transcript block.
    """
    llm = ChatGroq(temperature=0, model="llama-3.1-8b-instant", max_tokens=1500)
    
    prompt = PromptTemplate.from_template('''You are generating accurate Minutes of Meeting.

Agenda: 
{agenda}

Meeting Transcript: 
{transcript}

Instructions:
1. Extract ONLY factual points from the transcript text provided.
2. DO NOT make assumptions or infer beyond the context.
3. Break down the discussion specifically by each Agenda item.
4. Highlight overall decisions and action items separately at the end.
5. The transcript may contain English, Hindi, or Hinglish. Regardless of the language spoken, always translate and generate the final MoM strictly in English.

OUTPUT STRICTLY AS RAW JSON ONLY. DO NOT WRAP IN BACKTICKS. DO NOT INCLUDE ANY CONVERSATIONAL TEXT. ONLY RETURN THE JSON STRING:
{{
  "agenda_summaries": [
    {{
      "agenda_item": "Topic 1 from the Agenda",
      "summary": "Detailed factual summary of what was discussed regarding this topic."
    }},
    {{
      "agenda_item": "Topic 2 from the Agenda",
      "summary": "Detailed factual summary of what was discussed regarding this topic."
    }}
  ],
  "decisions": ["Decision 1", "Decision 2"],
  "action_items": ["Action 1", "Action 2"]
}}''')
    
    chain = prompt | llm
    response = chain.invoke({"agenda": agenda, "transcript": transcript})
    
    content = response.content
    try:
        # Strip out markdown backticks and possible introductory text
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            clean_json = match.group(0)
            data = json.loads(clean_json)
            return data
        else:
            raise ValueError("No JSON object found in response.")
    except Exception as e:
        print("LLM JSON parsing failed:", e)
        return {
            "agenda_summaries": [{"agenda_item": "Error", "summary": f"Parsing failed. Raw LLM response:\n{content}"}],
            "decisions": [],
            "action_items": []
        }
