from regex import *

def ipv4_address(ad):
	rg =  r"([1-9]?\d|1\d\d|2[0-4]\d|25[0-5])"
	return fullmatch(r'\.'.join([rg]*4),ad)!=None
