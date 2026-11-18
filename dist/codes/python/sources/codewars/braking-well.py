g = 9.81

def dist(v, mu):
	v /= 3.6
	return v+v*v/(2*mu*g)

def speed(d, mu):
	return ((mu*g*(mu*g+2*d))**.5-mu*g)*3.6