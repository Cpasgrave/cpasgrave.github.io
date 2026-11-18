def london_city_hacker(j): 
    t=cost=0
    for e in j:
    	if str(e)==e:
    		cost+=2.4
    		t=0
    	else:
    		cost+=1.5*(t==0)
    		t=1-t
    return f"£{cost:.2f}"