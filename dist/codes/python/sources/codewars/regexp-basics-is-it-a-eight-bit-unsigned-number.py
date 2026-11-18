from re import *
def eight_bit_number(n):
    pat = r"[1-9]?\d|1\d\d|2[0-4]\d|25[0-5]"
    return fullmatch(pat,n)!=None