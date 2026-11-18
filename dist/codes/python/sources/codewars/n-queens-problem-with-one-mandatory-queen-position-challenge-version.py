from random import shuffle

class diag: 1

def solve_n_queens(n,fixed_queen,iter=1):

	if iter>30*(n<100)+5: return None

	rg = range(n)
	fqx,fqy = fixed_queen
	board = [*range(fqy)]+[*range(fqy+1,n)]
	shuffle(board)
	board.insert(fqx,fqy)
	indices = set(range(n))-{fqx}
	
	xy2diag1 = [[i+j for j in rg]for i in rg]
	xy2diag2 = [[i-j+n-1 for i in rg]for j in rg]
	d1_count,d2_count = [],[]


	for i in range(2*n-1):
		diag1,diag2 = diag(),diag()
		diag1.n,diag2.n = 0,0
		diag1.alt,diag2.alt = 0,0
		diag1.pos,diag2.pos = set(),set()
		d1_count += [diag1]
		d2_count += [diag2]

	# collision map
	for x in rg:
		y = board[x]
		d1 = xy2diag1[x][y]
		d2 = xy2diag2[x][y]
		diag1 = d1_count[d1]
		diag2 = d2_count[d2]
		diag1.n += 1
		diag2.n += 1
		diag1.pos |= {(x,y)}
		diag2.pos |= {(x,y)}

	while True:

		# look for a collision
		collisions = [d for d in d1_count+d2_count if d.n>1]
		if collisions==[]: break

		swap = 0

		for coll in collisions:

			if swap: break

			# queen to swap (avoid fixed queen):
			for q in coll.pos-{fixed_queen}:

				if swap: break

				q1x,q1y = q

				# find the first swap lowering collisions
				for i in indices-{q1x,fqx}:

					q2x,q2y = (i,board[i])

					q1d1,q2d1 = xy2diag1[q1x][q1y],xy2diag1[q2x][q2y]
					q1d2,q2d2 = xy2diag2[q1x][q1y],xy2diag2[q2x][q2y]
					q1d1b,q2d1b = xy2diag1[q2x][q1y],xy2diag1[q1x][q2y]
					q1d2b,q2d2b = xy2diag2[q2x][q1y],xy2diag2[q1x][q2y]

					for d in {q1d1,q2d1,q1d1b,q2d1b}:
						d1_count[d].alt = d1_count[d].n
					for d in {q1d2,q2d2,q1d2b,q2d2b}:
						d2_count[d].alt = d2_count[d].n

					d1_count[q1d1].alt -= 1
					d1_count[q2d1].alt -= 1
					d2_count[q1d2].alt -= 1
					d2_count[q2d2].alt -= 1
					d1_count[q1d1b].alt += 1
					d1_count[q2d1b].alt += 1
					d2_count[q1d2b].alt += 1
					d2_count[q2d2b].alt += 1

					coll_d1 = sum(max(0,d1_count[d].n-1) for d in {q1d1,q2d1,q1d1b,q2d1b})
					coll_d2 = sum(max(0,d2_count[d].n-1) for d in {q1d2,q2d2,q1d2b,q2d2b})
					s1 = coll_d1+coll_d2

					coll_d1 = sum(max(0,d1_count[d].alt-1) for d in {q1d1,q2d1,q1d1b,q2d1b})
					coll_d2 = sum(max(0,d2_count[d].alt-1) for d in {q1d2,q2d2,q1d2b,q2d2b})
					s2 = coll_d1+coll_d2

					if s2<s1:
						# swap
						swap = 1
						board[q1x],board[q2x] = q2y,q1y

						d1_count[q1d1].n -= 1
						d1_count[q1d1].pos -= {(q1x,q1y)}
						d2_count[q1d2].n -= 1
						d2_count[q1d2].pos -= {(q1x,q1y)}
						d1_count[q2d1].n -= 1
						d1_count[q2d1].pos -= {(q2x,q2y)}
						d2_count[q2d2].n -= 1
						d2_count[q2d2].pos -= {(q2x,q2y)}

						d1_count[q1d1b].n += 1
						d1_count[q1d1b].pos |= {(q2x,q1y)}
						d2_count[q1d2b].n += 1
						d2_count[q1d2b].pos |= {(q2x,q1y)}
						d1_count[q2d1b].n += 1
						d1_count[q2d1b].pos |= {(q1x,q2y)}
						d2_count[q2d2b].n += 1
						d2_count[q2d2b].pos |= {(q1x,q2y)}
						break
		if swap==0:
			return solve_n_queens(n,fixed_queen,iter+1)

	board  = ''.join(['.'*y+'Q'+'.'*(n-y-1)+'\n' for y in board])
	return board

