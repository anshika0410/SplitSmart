from collections import defaultdict
from typing import List, Dict

def simplify_debts(balances: List) -> List[Dict]:
    """
    Min Cash Flow algorithm to simplify debts.
    Takes a list of Balance objects and returns a list of simplified transaction dictionaries.
    """
    # 1. Calculate net balance for each person
    net_balances = defaultdict(float)
    
    for balance in balances:
        net_balances[balance.user_id] -= balance.amount # user_id owes money, so their balance decreases
        net_balances[balance.owes_to_user_id] += balance.amount # owes_to_user_id receives money, so their balance increases
        
    # 2. Separate into debtors (negative balance) and creditors (positive balance)
    debtors = [] # List of (user_id, amount_owed)
    creditors = [] # List of (user_id, amount_to_receive)
    
    for user_id, amount in net_balances.items():
        if amount < -0.01: # Use small epsilon for floating point issues
            debtors.append((user_id, -amount))
        elif amount > 0.01:
            creditors.append((user_id, amount))
            
    # Sort to optimize matching (largest debtor with largest creditor)
    debtors.sort(key=lambda x: x[1], reverse=True)
    creditors.sort(key=lambda x: x[1], reverse=True)
    
    # 3. Greedily match debtors and creditors
    simplified_transactions = []
    i, j = 0, 0
    
    while i < len(debtors) and j < len(creditors):
        debtor_id, debt_amount = debtors[i]
        creditor_id, credit_amount = creditors[j]
        
        # Take the minimum of what debtor owes and what creditor needs to receive
        settle_amount = min(debt_amount, credit_amount)
        
        simplified_transactions.append({
            "from_user_id": debtor_id,
            "to_user_id": creditor_id,
            "amount": round(settle_amount, 2)
        })
        
        # Update remaining amounts
        debtors[i] = (debtor_id, debt_amount - settle_amount)
        creditors[j] = (creditor_id, credit_amount - settle_amount)
        
        if debtors[i][1] < 0.01:
            i += 1
        if creditors[j][1] < 0.01:
            j += 1
            
    return simplified_transactions
