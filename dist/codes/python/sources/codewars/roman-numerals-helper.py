class RomanNumerals:
	def to_roman(n):
		n = str(n)
		pat = '.0.00.000.01.1.10.100.1000.02'.split('.')
		res = [''.join(['IVXLCDMvxlcdm'[int(i)+2*s] for i in pat[int(n[::-1][s])]]) for s in range(len(n))]
		return ''.join(res[::-1])
	def from_roman(r):
		d = {'M': 1000, 'D': 500, 'C': 100, 'L': 50, 'X': 10, "V":5, 'I': 1}
		return sum([-d[r[i]] if d[r[i]]<d[r[i+1]] else d[r[i]] for i in range(len(r)-1)]+[d[r[-1]]])