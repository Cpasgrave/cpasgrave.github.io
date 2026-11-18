def validate_battlefield(field):
	visited,ships,rg = set(),{},range(10)
	near = [(i,j)for i in (-1,0,1)for j in (-1,0,1)]
	for i in rg:
		for j in rg:
			if (i,j) in visited: continue
			if field[i][j]:
				ship = {(i,j)}
				k,size = 1,1
				while i+k<10 and field[i+k][j]:
					ship |= {(i+k,j)}
					visited |= {(i+k,j)}
					size += 1
					k += 1
				k = 1
				while j+k<10 and field[i][j+k]:
					ship |= {(i,j+k)}
					visited |= {(i,j+k)}
					size += 1
					k += 1
				ships[size] = ships.get(size,0)+1
				if {(i+k,j+l)for i,j in ship for k,l in near if not{i+k,j+l}-{*rg} and field[i+k][j+l]}-ship:
					return 0
	return ships=={4:1,3:2,2:3,1:4}