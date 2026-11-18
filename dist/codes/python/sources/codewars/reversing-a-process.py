def decode(s):
	alphabet = "abcdefghijklmnopqrstuvwxyz"
	m,n = '',''
	for c in s:
		if c in alphabet: m += c
		else: n += c
	n,conv = int(n),{}
	for i,c in enumerate(alphabet):
		j = i*n%26
		c2 = alphabet[j]
		if c2 in conv: return "Impossible to decode"
		conv[c2] = c
	return ''.join([conv[c]for c in m])