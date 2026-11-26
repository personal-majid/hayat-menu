import csv, sys, os, json, statistics as st
from collections import defaultdict
from datetime import date, timedelta
D = sys.argv[1]
bills = list(csv.DictReader(open(os.path.join(D, 'bills.csv'), encoding='utf-8')))
items = list(csv.DictReader(open(os.path.join(D, 'items.csv'), encoding='utf-8')))
PRE = 'prebooking_over_4000' if 'prebooking_over_4000' in bills[0] else 'prebooking'
wd = lambda d: date.fromisoformat(d).weekday()
# per day parts: channel x session, customer bills, pre-bookings out
V = defaultdict(lambda: defaultdict(float))
for b in bills:
    if b[PRE] == '1': continue
    d = b['day']; v = float(b['total_rs']); ch = b['channel']; s = 'L' if b['session'] == 'lunch' else 'E'
    V[d]['all'] += v; V[d]['n'] += 1; V[d][ch + s] += v; V[d][s] += v; V[d][ch] += v; V[d]['n' + ch] += 1
days = sorted(V)
byw = defaultdict(list)
for d in days: byw[wd(d)].append(V[d]['all'])
mw = {w: st.median(v) for w, v in byw.items()}; mm = st.mean(mw.values()); WI = {w: mw[w] / mm for w in mw}
# dishes: Alfaham Mandi / Chicken Mandi, birds (Full 1, Half .5, Qtr .25) and Rs, by channel
def sz(n):
    n = n.upper()
    return 1 if 'FULL' in n else .5 if 'HALF' in n else .25 if ('QTR' in n or 'QUARTER' in n) else 0
A = defaultdict(lambda: defaultdict(float))
newg = {'King fish', 'Other fish & prawns', 'Meals', 'Biriyani'}
for it in items:
    if it[PRE] == '1': continue
    d = it['day']; g = it['group']; a = float(it['amount_rs']); q = float(it['qty']); ch = it['channel']
    if g in ('Alfaham Mandi', 'Chicken Mandi'):
        k = 'alf' if g == 'Alfaham Mandi' else 'chm'
        A[d][k + '_b'] += q * sz(it['item']); A[d][k + '_rs'] += a
        A[d][k + ch + '_b'] += q * sz(it['item']); A[d][k + ch + '_rs'] += a
        if ch in ('CO', 'Delivery'): A[d]['ac_out_b'] += q * sz(it['item']); A[d]['ac_out_rs'] += a
    if g in newg: A[d]['new_rs'] += a; A[d]['new' + it['session'][0].upper()] += a
P = [('A', 'Before boards', '14 Jul – 19 Aug', '2026-07-14', '2026-08-19'),
     ('B', 'Boards up + Onam', '20 – 31 Aug', '2026-08-20', '2026-08-31'),
     ('C', 'Settled', '1 Sep – 10 Oct', '2026-09-01', '2026-10-10'),
     ('D', 'Dasara holidays', '11 – 24 Oct', '2026-10-11', '2026-10-24'),
     ('E', 'Price rise (all items)', '25 Oct – 11 Nov', '2026-10-25', '2026-11-11'),
     ('F', 'Saudi escalation + Sabarimala', '12 – 20 Nov', '2026-11-12', '2026-11-20'),
     ('G', 'Offer: Alfaham & Chicken Mandi on CO / delivery', '21 – 25 Nov', '2026-11-21', '2026-11-25')]
def per(a, b, f, adj=True):
    R = [d for d in days if a <= d <= b]
    return sum(f(d) / (WI[wd(d)] if adj else 1) for d in R) / len(R), len(R)
out = []
for k, lab, when, a, b in P:
    g = lambda key, adj=True: per(a, b, lambda d: V[d][key], adj)[0]
    h = lambda key: per(a, b, lambda d: A[d][key])[0]
    out.append({'k': k, 'lab': lab, 'when': when, 'n': per(a, b, lambda d: 1, False)[1], 'all': g('all'), 'raw': g('all', False), 'bills': g('n'),
                'L': g('L'), 'E': g('E'), 'DineL': g('DineL'), 'DineE': g('DineE'), 'CO': g('CO'), 'Delivery': g('Delivery'),
                'nDine': g('nDine'), 'nCO': g('nCO'), 'nDelivery': g('nDelivery'),
                'alf_b': h('alf_b'), 'chm_b': h('chm_b'), 'alf_rs': h('alf_rs'), 'chm_rs': h('chm_rs'), 'ac_out_b': h('ac_out_b'), 'ac_out_rs': h('ac_out_rs'),
                'new_rs': h('new_rs'), 'newL': h('newL')})
for i, x in enumerate(out):
    pv = out[i - 1] if i else None
    line = f"{x['k']} {x['lab']:48s} {x['n']:2d}d  Rs{x['all']/1e3:5.1f}K (raw {x['raw']/1e3:5.1f}K) bills {x['bills']:5.1f} | L {x['L']/1e3:4.1f}K E {x['E']/1e3:4.1f}K | DineL {x['DineL']/1e3:4.1f} DineE {x['DineE']/1e3:4.1f} CO {x['CO']/1e3:4.1f} Del {x['Delivery']/1e3:4.1f} | new dishes {x['new_rs']/1e3:4.1f}K | ALF {x['alf_b']:4.1f}b Rs{x['alf_rs']/1e3:4.1f}K CHM {x['chm_b']:3.1f}b Rs{x['chm_rs']/1e3:3.1f}K | A+C on CO/Del {x['ac_out_b']:4.1f}b Rs{x['ac_out_rs']/1e3:4.1f}K"
    print(line)
    if pv:
        T = pv['all']; ch = (x['all'] - T) / T * 100
        parts = {p: (x[p] - pv[p]) / T * 100 for p in ('DineL', 'DineE', 'CO', 'Delivery')}
        print(f"     change vs {pv['k']}: {ch:+.1f}%  =  " + '  '.join(f'{p} {v:+.1f}pt' for p, v in parts.items()) + f"   (rest {ch - sum(parts.values()):+.1f})")
json.dump(out, open(os.path.join(os.path.dirname(sys.argv[0]), 'story2.json'), 'w'), indent=1)

# offer check: each of 21-25 Nov vs the SAME weekday 1, 2, 3, 4 weeks before (mean), CO + delivery Alfaham & Chicken Mandi
print('\nOFFER days vs the same weekday in the 4 weeks before (mean)')
rows = []
for d in [x for x in days if '2026-11-21' <= x <= '2026-11-25']:
    prev = [(date.fromisoformat(d) - timedelta(days=7 * i)).isoformat() for i in (1, 2, 3, 4)]
    prev = [p for p in prev if p in V]
    m = lambda f: sum(f(p) for p in prev) / len(prev)
    r = {'d': d, 'ac_b': A[d]['ac_out_b'], 'ac_b0': m(lambda p: A[p]['ac_out_b']), 'ac_rs': A[d]['ac_out_rs'], 'ac_rs0': m(lambda p: A[p]['ac_out_rs']),
         'out': V[d]['CO'] + V[d]['Delivery'], 'out0': m(lambda p: V[p]['CO'] + V[p]['Delivery']), 'nout': V[d]['nCO'] + V[d]['nDelivery'], 'nout0': m(lambda p: V[p]['nCO'] + V[p]['nDelivery']),
         'all': V[d]['all'], 'all0': m(lambda p: V[p]['all']), 'dine': V[d]['Dine'], 'dine0': m(lambda p: V[p]['Dine'])}
    rows.append(r); print({k: (round(v, 1) if isinstance(v, float) else v) for k, v in r.items()})
S = lambda k: sum(r[k] for r in rows)
print('TOTAL 5 days: A+C birds CO/Del', round(S('ac_b'), 1), 'vs', round(S('ac_b0'), 1), f"{(S('ac_b')/S('ac_b0')-1)*100:+.0f}%",
      '| A+C Rs', round(S('ac_rs')), 'vs', round(S('ac_rs0')), f"{(S('ac_rs')/S('ac_rs0')-1)*100:+.0f}%",
      '| CO+Del Rs', round(S('out')), 'vs', round(S('out0')), f"{(S('out')/S('out0')-1)*100:+.0f}%",
      '| CO+Del bills', round(S('nout')), 'vs', round(S('nout0')), f"{(S('nout')/S('nout0')-1)*100:+.0f}%",
      '| dine Rs', f"{(S('dine')/S('dine0')-1)*100:+.0f}%", '| all Rs', round(S('all')), 'vs', round(S('all0')), f"{(S('all')/S('all0')-1)*100:+.0f}%",
      '| A+C extra Rs as % of all', f"{(S('ac_rs')-S('ac_rs0'))/S('all0')*100:+.1f}pt")
# the 5 days just before the offer (16-20 Nov) on the same basis, to see if the slide was already there
rows2 = []
for d in [x for x in days if '2026-11-16' <= x <= '2026-11-20']:
    prev = [(date.fromisoformat(d) - timedelta(days=7 * i)).isoformat() for i in (1, 2, 3, 4)]
    m = lambda f: sum(f(p) for p in prev) / len(prev)
    rows2.append({'ac_b': A[d]['ac_out_b'], 'ac_b0': m(lambda p: A[p]['ac_out_b']), 'out': V[d]['CO'] + V[d]['Delivery'], 'out0': m(lambda p: V[p]['CO'] + V[p]['Delivery']), 'all': V[d]['all'], 'all0': m(lambda p: V[p]['all'])})
S2 = lambda k: sum(r[k] for r in rows2)
print('BEFORE offer 16-20 Nov same basis: A+C birds CO/Del', f"{(S2('ac_b')/S2('ac_b0')-1)*100:+.0f}%", '| CO+Del Rs', f"{(S2('out')/S2('out0')-1)*100:+.0f}%", '| all', f"{(S2('all')/S2('all0')-1)*100:+.0f}%")
