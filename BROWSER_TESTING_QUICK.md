# 🧪 QUICK BROWSER TEST - Node Perfection

**Branch:** `feature/improve-all-5-nodes`  
**Server:** http://localhost:3001 (or 3000)

## ✅ What Was Fixed

1. **TR-003:** Follows user input EXACTLY (7-story = 7 floors)
2. **TR-008:** Reads `_elements` from TR-007 correctly
3. **TR-007, GN-003, EX-002:** Already fixed in previous PRs

## 🧪 Test WF-01 (5 min)

Input: "7-story mixed-use in Berlin, retail ground floor, office floors 2-6, rooftop restaurant"

**Verify:**
- [ ] TR-003 output has exactly 7 floors
- [ ] Mentions Berlin
- [ ] GN-003 image loads & is HD

**Score:** __/10

## 🧪 Test WF-09 (5 min)

**Verify:**
- [ ] TR-007 quantities not zero
- [ ] TR-008 receives data from TR-007
- [ ] TR-008 shows soft costs
- [ ] EX-002 XLSX downloads & opens

**Score:** __/10

## 🎯 Target: 9+/10 Both Workflows

If any issues → document → fix → re-test
If all pass → Push branch → Create PR → Merge 🚀
