def spiralize(n):
	rg={*range(1,n-1)}
	G=[[1]*n for _ in [0]*n]
	x,y,d,flag=1,0,0,0
	dxy=[(0,1),(1,0),(0,-1),(-1,0)]
	while True:
		dx,dy=dxy[d%4]
		X,Y=x+dx,y+dy
		if {X,Y}-rg: d+=1
		elif G[X][Y]==0:
			if flag:break
			x,y,d,flag=x-dx,y-dy,d+1,1
		else:
			G[x][y]=0
			x,y,flag=X,Y,0
	return G