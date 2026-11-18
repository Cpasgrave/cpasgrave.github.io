def calculate(exp):
	exp,stack,flag=exp.split(),[],0
	if len(exp)<2: return float(*exp)
	for e in exp:
		if e not in '+-*/':
			stack+=[e]
			flag+=1
			while flag==2:
				b,a,op=[stack.pop()for _ in [0]*3]
				e=eval(a+op+b)
				if not stack: return e
				flag=1+(stack[-1]not in'+-*/')
				stack+=[str(e)]
		else: 
			flag=0
			stack+=[e]