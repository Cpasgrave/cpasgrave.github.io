def format_duration(t):
	q=[60,60,24,365,9**9]
	s=["second","minute","hour","day","year"]
	r=[f"{m} {s[i]}{'s'*(m>1)}"for t in[t]for i in range(5)for t,m in[divmod(t,q[i])]if m][::-1]
	return r and f"{' and '*(len(r)>1)}".join([', '.join(r[:-1]),r[-1]])or'now'