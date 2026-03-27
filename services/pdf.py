from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from datetime import datetime

def create_pdf(mom_data: dict) -> str:
    """Creates a formatted PDF from the structured MOM data."""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"output/MoM_{timestamp}.pdf"
    
    doc = SimpleDocTemplate(filename, pagesize=letter)
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    header_style = styles['Heading2']
    normal_style = styles['Normal']
    
    story = []
    
    story.append(Paragraph("Minutes of Meeting", title_style))
    story.append(Paragraph(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}", normal_style))
    story.append(Spacer(1, 0.2*inch))
    
    story.append(Paragraph("Discussion by Agenda", header_style))
    agenda_summaries = mom_data.get("agenda_summaries", [])
    if isinstance(agenda_summaries, list):
        for item in agenda_summaries:
            topic = item.get("agenda_item", "Topic")
            summary = item.get("summary", "")
            story.append(Paragraph(f"<b>{topic}</b>", normal_style))
            story.append(Paragraph(summary, normal_style))
            story.append(Spacer(1, 0.1*inch))
    elif mom_data.get("summary"):
        # Fallback for old format
        story.append(Paragraph(mom_data.get("summary", ""), normal_style))
    story.append(Spacer(1, 0.2*inch))
    
    story.append(Paragraph("Decisions", header_style))
    decisions = mom_data.get("decisions", [])
    if decisions:
        items = [ListItem(Paragraph(d, normal_style)) for d in decisions]
        story.append(ListFlowable(items, bulletType='bullet'))
    else:
        story.append(Paragraph("No specific decisions recorded.", normal_style))
    story.append(Spacer(1, 0.2*inch))
    
    story.append(Paragraph("Action Items", header_style))
    actions = mom_data.get("action_items", [])
    if actions:
        items = [ListItem(Paragraph(a, normal_style)) for a in actions]
        story.append(ListFlowable(items, bulletType='bullet'))
    else:
        story.append(Paragraph("No specific action items recorded.", normal_style))
        
    doc.build(story)
    return filename
