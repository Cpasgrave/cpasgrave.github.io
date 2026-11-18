from re import *

def to_integer(string):
	pat = r"[+-]?(()|(0b)|(0o)|(0x))(?(2)(\d+)|(?(3)([01]+)|(?(4)([0-7]+)|(?(5)([\da-fA-F]+)|()))))"
	m = fullmatch(pat, string)
	base = {'':10,'0b':2,'0o':8,'0x':16}
	return int(string,base[m[1]]) if m else None