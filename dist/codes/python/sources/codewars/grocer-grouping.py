def group_groceries(g):
	d={'fruit':[],'meat':[],'other':[],'vegetable':[]}
	for c,i in [e.split('_')for e in g.split(',')]:
		d[c if c in'fruitmeatvegetable'else'other']+=[i]
	return '\n'.join([k+':'+','.join(sorted(v))for k,v in d.items()])