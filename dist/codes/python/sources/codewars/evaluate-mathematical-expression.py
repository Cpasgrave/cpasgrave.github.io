import re
from operator import add,sub,mul,truediv

#tools
op={'/':truediv,'*':mul,'-':sub,'+':add}
p=r"[(]{1}([^()]+)[)]{1}"
pat=lambda op:r"(\-*[0-9.]+(e{1}[+-]{1}\d+)*) +(["+op+r"]{1}) +(\-*[0-9.]+(e{1}[+-]{1}\d+)*)"
clean=lambda x:x.replace('--','+')
s=lambda x:str(op[x[3]](float(recur(x[1])),float(recur(x[4]))))

def recur(exp):
    print(exp)
	# send to recursion the inner parenthesis while there are any
    while '(' in exp:
        exp = re.sub(p,lambda x:str(recur(x[1])),exp)
    else:
        # applying * and /
        while "*" in exp or "/" in exp: 
            exp = re.sub(pat('*/'),s,exp,1)
        # applying + and -
        while re.search(pat('+-'),exp): 
            exp = re.sub(pat('+-'),s,exp,1)
        return float(clean(exp))

def prepare(exp):
	for o in '+*/': exp = exp.replace(o,f" {o} ")
	while '  ' in exp: exp = exp.replace('  ',' ')
	prev,i = '',-1
	while i<len(exp)-1:
		i += 1
		c = exp[i]
		if c=='-':
			if prev in '(+-*/': continue
			exp = exp[:i]+' - '+exp[i+1:]
		if c!=' ': prev = c
	return exp

def calc(exp):
	exp = prepare(exp)
	exp = recur(exp)
	return exp