def solution(A):
	start = end = A[0]
	ans = []
	for n in A+[A[-1]+2]:
		if n>end+1:
			if start==end:
				ans.append(str(end))
				start = end = n
			else:
				if end == start+1:
					ans += [str(start),str(end)]
				else: ans.append(str(start)+"-"+str(end))
				start = end = n
		else:
			end = n
	return ','.join(ans)