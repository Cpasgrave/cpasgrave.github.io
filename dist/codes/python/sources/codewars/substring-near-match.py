def near_matches(substring, text):
	# produces all the possible 'near matches' 
	# then check if matches any word (lowercased and cleaned)
	s = substring.lower()
	if len(s)<2: raise ValueError
	near = {s}
	for i,c in enumerate(s):
		# transpo
		for j,d in enumerate(s[i+1:],i+1):
			t = [*s]
			t[i],t[j] = d,c
			near |= {''.join(t)}
		# double
		near |= {(s[:i+1]+s[i:])}
		# exclu
		near |= {(s[:i]+s[i+1:])}
	matches = {}
	for i,line in enumerate(text.splitlines(),1):
		for w in line.split():
			word = ''.join(c for c in w if c.isalpha()).lower()
			if word in near: matches[i] = matches.get(i,[])+[w]
	return matches