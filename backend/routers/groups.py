from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import csv
from io import StringIO, BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/groups",
    tags=["groups"],
)

@router.post("/", response_model=schemas.Group)
def create_group(group: schemas.GroupCreate, current_user_id: int, db: Session = Depends(get_db)):
    # In a real app with auth, current_user_id would come from the JWT token.
    # For now, the frontend will pass it as a query parameter
    return crud.create_group(db=db, group=group, creator_id=current_user_id)

@router.get("/", response_model=List[schemas.Group])
def read_groups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    groups = crud.get_groups(db, skip=skip, limit=limit)
    return groups

@router.post("/{group_id}/members", response_model=schemas.GroupMember)
def add_member(group_id: int, user_id: int, is_admin: bool = False, db: Session = Depends(get_db)):
    return crud.add_user_to_group(db=db, group_id=group_id, user_id=user_id, is_admin=is_admin)

@router.get("/{group_id}/members", response_model=List[schemas.User])
def read_group_members(group_id: int, db: Session = Depends(get_db)):
    return crud.get_group_members(db, group_id=group_id)

@router.get("/{group_id}/members_detailed")
def read_group_members_detailed(group_id: int, db: Session = Depends(get_db)):
    members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
    result = []
    for m in members:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        if user:
            result.append({
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "is_admin": m.is_admin
            })
    return result

@router.get("/user/{user_id}", response_model=List[schemas.Group])
def read_user_groups(user_id: int, archived: bool = False, db: Session = Depends(get_db)):
    return crud.get_user_groups(db, user_id=user_id, archived=archived)

@router.post("/join/{invite_code}", response_model=schemas.GroupMember)
def join_group_by_invite(invite_code: str, user_id: int, db: Session = Depends(get_db)):
    group = crud.get_group_by_invite_code(db, invite_code=invite_code)
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    return crud.add_user_to_group(db=db, group_id=group.id, user_id=user_id, is_admin=False)

def check_admin(db: Session, group_id: int, user_id: int):
    member = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == user_id).first()
    if not member or not member.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized. Only group admins can perform this action.")

@router.delete("/{group_id}")
def delete_group(group_id: int, requester_id: int, db: Session = Depends(get_db)):
    check_admin(db, group_id, requester_id)
    success = crud.delete_group(db, group_id=group_id)
    return {"success": success}

@router.patch("/{group_id}", response_model=schemas.Group)
def update_group(group_id: int, requester_id: int, group_update: schemas.GroupCreate, db: Session = Depends(get_db)):
    check_admin(db, group_id, requester_id)
    updated = crud.update_group(db, group_id=group_id, group_update=group_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Group not found")
    return updated

@router.post("/{group_id}/archive", response_model=schemas.Group)
def archive_group(group_id: int, requester_id: int, db: Session = Depends(get_db)):
    check_admin(db, group_id, requester_id)
    archived = crud.archive_group(db, group_id=group_id)
    if not archived:
        raise HTTPException(status_code=404, detail="Group not found")
    return archived

@router.post("/{group_id}/unarchive", response_model=schemas.Group)
def unarchive_group(group_id: int, requester_id: int, db: Session = Depends(get_db)):
    check_admin(db, group_id, requester_id)
    unarchived = crud.unarchive_group(db, group_id=group_id)
    if not unarchived:
        raise HTTPException(status_code=404, detail="Group not found")
    return unarchived

@router.delete("/{group_id}/members/{user_id}")
def remove_member(group_id: int, user_id: int, requester_id: int, db: Session = Depends(get_db)):
    # You can leave if you are removing yourself, otherwise must be admin
    if user_id != requester_id:
        check_admin(db, group_id, requester_id)
    success = crud.remove_user_from_group(db, group_id=group_id, user_id=user_id)
    return {"success": success}

@router.get("/{group_id}/analytics")
def get_group_analytics(group_id: int, db: Session = Depends(get_db)):
    # 1. Verify group exists
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    # 2. Get all expenses for the group
    expenses = db.query(models.Expense).filter(models.Expense.group_id == group_id).all()
    
    total_spending = sum(e.amount for e in expenses)
    
    if total_spending == 0:
        return {
            "total_spending": 0,
            "highest_spender": None,
            "common_category": None,
            "member_breakdown": [],
            "monthly_trend": []
        }
        
    # 3. Calculate category frequencies
    cat_counts = {}
    for e in expenses:
        cat = e.category if e.category else "other"
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    common_category = max(cat_counts, key=cat_counts.get) if cat_counts else "other"
    
    # 4. Member breakdown
    # Get all members first to ensure everyone is listed even with 0 spending
    members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
    user_ids = [m.user_id for m in members]
    users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    user_map = {u.id: u.name for u in users}
    
    member_map = {m.user_id: {"user_id": m.user_id, "name": user_map.get(m.user_id, "Unknown"), "amount": 0, "percentage": 0} for m in members}
    
    for e in expenses:
        if e.payer_id in member_map:
            member_map[e.payer_id]["amount"] += e.amount
        else:
            # Payer might have left the group, or is not in members list
            user = db.query(models.User).filter(models.User.id == e.payer_id).first()
            name = user.name if user else "Unknown"
            member_map[e.payer_id] = {"user_id": e.payer_id, "name": name, "amount": e.amount, "percentage": 0}
            
    breakdown = []
    highest_spender = None
    max_amount = -1
    
    for uid, data in member_map.items():
        if data["amount"] > 0:
            data["percentage"] = round((data["amount"] / total_spending) * 100, 1)
        if data["amount"] > max_amount:
            max_amount = data["amount"]
            highest_spender = {"name": data["name"], "amount": data["amount"]}
        breakdown.append(data)
        
    # Sort breakdown by amount descending
    breakdown.sort(key=lambda x: x["amount"], reverse=True)
    
    # 5. Monthly trend
    monthly_trend = {}
    for e in expenses:
        month_str = e.created_at.strftime("%b %Y")
        monthly_trend[month_str] = monthly_trend.get(month_str, 0) + e.amount
        
    trend_list = [{"month": k, "amount": v} for k, v in monthly_trend.items()]
    # Simple sort based on date (assuming recent expenses) - fine for MVP
    
    return {
        "total_spending": total_spending,
        "highest_spender": highest_spender,
        "common_category": common_category,
        "member_breakdown": breakdown,
        "monthly_trend": trend_list
    }

def get_report_data(group_id: int, db: Session):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    expenses = db.query(models.Expense).filter(models.Expense.group_id == group_id).order_by(models.Expense.created_at.desc()).all()
    
    rows = []
    for e in expenses:
        payer = e.payer.name if e.payer else "Unknown"
        date_str = e.created_at.strftime("%Y-%m-%d %H:%M") if e.created_at else "Unknown"
        cat = e.category.capitalize() if e.category else "Other"
        
        for split in e.splits:
            if split.user_id != e.payer_id:
                split_user = split.user.name if split.user else "Unknown"
                status = "Pending" # Simplified for MVP
                amount = e.amount or 0
                owed = split.amount_owed or 0
                
                # Sanitize description for PDF rendering (prevent black squares)
                safe_desc = (e.description or "").replace('₹', 'Rs.')
                
                rows.append([
                    date_str, safe_desc, cat, f"{amount:.2f}",
                    payer, split_user, f"{owed:.2f}", status
                ])
    return group, expenses, rows

@router.get("/{group_id}/export/csv")
def export_csv(group_id: int, currency: str = "₹", db: Session = Depends(get_db)):
    group, expenses, rows = get_report_data(group_id, db)
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Summary Header
    writer.writerow(["Group Name", group.name])
    writer.writerow(["Generated On", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    total = sum((e.amount or 0) for e in expenses)
    writer.writerow(["Total Spending", f"{currency} {total:.2f}"])
    writer.writerow(["Total Expenses", len(expenses)])
    writer.writerow([])
    
    # Table Headers
    writer.writerow(["Date", "Description", "Category", "Total Amount", "Paid By", "Split Member", "Individual Share", "Status"])
    
    for row in rows:
        writer.writerow(row)
        
    output.seek(0)
    filename = f"{group.name.replace(' ', '_')}_Report_{datetime.now().strftime('%Y-%m-%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{group_id}/export/pdf")
def export_pdf(group_id: int, currency: str = "₹", db: Session = Depends(get_db)):
    # Helvetica doesn't support ₹, so we fallback to Rs. to prevent black squares
    if currency == '₹':
        currency = 'Rs.'
        
    group, expenses, rows = get_report_data(group_id, db)
    
    # Sanitize group name for PDF
    safe_group_name = group.name.replace('₹', 'Rs.')
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    elements.append(Paragraph(f"<b>{safe_group_name} - Expense Report</b>", styles['Title']))
    elements.append(Spacer(1, 12))
    
    # Summary
    total = sum((e.amount or 0) for e in expenses)
    elements.append(Paragraph(f"<b>Generated On:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
    elements.append(Paragraph(f"<b>Total Spending:</b> {currency} {total:.2f}", styles['Normal']))
    elements.append(Paragraph(f"<b>Total Expenses:</b> {len(expenses)}", styles['Normal']))
    elements.append(Spacer(1, 24))
    
    # Table Data
    table_data = [["Date", "Description", "Category", "Total", "Paid By", "Split Member", "Share", "Status"]]
    for row in rows:
        table_data.append(row)
        
    t = Table(table_data, repeatRows=1 if len(rows) > 0 else 0)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C5CE7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8F9FA')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E9ECEF')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
    ]))
    
    elements.append(t)
    
    # Balance Summary
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("<b>Balance Summary</b>", styles['Heading2']))
    
    # Calculate balances
    members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
    user_ids = [m.user_id for m in members]
    users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    user_map = {u.id: u.name for u in users}
    
    balances = db.query(models.Balance).filter(models.Balance.group_id == group_id).all()
    net_balances = {uid: 0.0 for uid in user_ids}
    
    for b in balances:
        if b.user_id in net_balances:
            net_balances[b.user_id] -= b.amount
        if b.owes_to_user_id in net_balances:
            net_balances[b.owes_to_user_id] += b.amount
            
    for uid, net in net_balances.items():
        name = user_map.get(uid, "Unknown")
        if net > 0:
            elements.append(Paragraph(f"{name} → Should Receive {currency}{net:.2f}", styles['Normal']))
        elif net < 0:
            elements.append(Paragraph(f"{name} → Owes {currency}{abs(net):.2f}", styles['Normal']))
        else:
            elements.append(Paragraph(f"{name} → Settled Up", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"{group.name.replace(' ', '_')}_Report_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
