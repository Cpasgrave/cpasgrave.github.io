class Board:

	def __init__(s,start,target):
		s.start = start
		s.B = [s[:]for s in start]
		s.T = target
		s.h = len(s.B)
		s.w = len(s.B[0])
		s.position = {e:[i,j] for i,r in enumerate(s.B)for j,e in enumerate(r)}
		s.moves = []
		s.buffer = [] # used to store moves before applying them

	def move(s,m):
		# a row or column move is applied, 
		# and the modified positions updated
		d = m[0]
		idx = int(m[1:])
		if d in 'RL':
			j = -1 if d=='R' else -s.w+1
			s.B[idx] = [s.B[idx][i+j]for i in range(s.w)]
			for j,e in enumerate(s.B[idx]):
				s.position[e][1] = j
		else:
			k = -1 if d=='D' else -s.h+1
			s.B = [[c if j!=idx else s.B[i+k][j]for j,c in enumerate(r)]for i,r in enumerate(s.B)]
			for i in range(s.h):
				s.position[s.B[i][idx]][0] = i

	def update(s,e=None):
		# apply the sequence of moves present in the buffer
		# then clean the buffer
		for m in s.buffer: 
			s.move(m)
			s.moves += [m]
		s.buffer = []
		return e and s.position[e] or None

	def final_sort(s,mess,target,rec):

		# the sorting process:
		# - parse the ordered array elements
		# 	identify the first for which the previous is not at its left
		# - give it 'jumps' of 2 to the right untill it has the previous 
		#   ordered element at its left
		# - if it reaches the situation : xxxxxba and cannot jump,
		#   use the highest ordered element at b's left by bringing it
		#   right of b and allow b's jump:
		#   xcxxxxba -> xxxcxxba -> xxxxxcba -> xxxxxbac -> xxxxxacb
		#   the movements applied to the array are simultaneously
		# 	appplied to the board (using buffer and update)
		arr = mess[:]
		indx = {e:i for i,e in enumerate(target)}
		def jump_2R(el,i1,i2):
			jump = [f"D{s.w-1}",f"R{s.h-1}",f"U{s.w-1}",f"R{s.h-1}",f"D{s.w-1}",f"L{s.h-1}",f"L{s.h-1}",f"U{s.w-1}"]
			arr.insert(i2,arr.pop(i1))
			slide = s.w-3-s.position[el][1]
			s.buffer = [f"{'LR'[slide>0]}{s.h-1}"]*abs(slide)+jump
			s.update()

		while arr[:-2]!=target[:-2]:
			prev = target[0]
			for i,e in enumerate(target):
				e_i = arr.index(e)
				prev_i = arr.index(prev)
				while e_i<prev_i:
					if e_i==s.w-2: # xxxba situation
						x,f,f_i = max([(indx[f],f,i) for i,f in enumerate(arr[:e_i])if indx[f]>indx[e]],default=(None,None,None))
						if f==None: break
						while f_i<e_i:
							jump_2R(f,f_i,f_i+2)
							f_i += 2
						e_i -= 1
					else: # b's simple jump
						jump_2R(e,e_i,e_i+2)
						e_i += 2
				prev = e

		# set the first element at the leftmost index
		s.buffer = [f"L{s.h-1}"]*s.position[s.T[-1][0]][1]
		s.update()

		if s.B[-1]==target:	
			return 'solved'
		# both height and width are odd:
		if s.w%2 and s.h%2:
			return 'unsolvable'
		# width is even:
		if s.w%2==0:
			e = s.T[-1][-1]
			e_i = arr.index(e)
			for i in range(s.w//2):
				i2 = (e_i+2)%(s.w-1)
				jump_2R(e,e_i,i2)
				e_i = i2
			return 'solved'
		# only height is even:
		if s.h==2:
			s.buffer = [f"U{s.w-1}",f"R{s.h-1}",f"D{s.w-1}",f"L{s.h-1}",f"D{s.w-1}"]
			s.update()
			return 'solved'
		# recursion case:
		s.B = [s[:] for s in s.start]
		s.position = {e:[i,j] for i,r in enumerate(s.B)for j,e in enumerate(r)}
		s.moves,s.buffer = [],[]
		s.solve(rec+1)

	def solve(s,rec=0):

		# recursion case:
		if rec:
			s.buffer = [f"U{s.w-1}"]*rec+[f"R{s.h-1}",f"U{s.w-1}",f"L{s.h-1}",f"U{s.w-1}",f"R{s.h-1}",f"D{s.w-1}",f"D{s.w-1}",f"L{s.h-1}",f"U{s.w-1}"]
			s.update()

		# solving first line:
		for j in range(s.w):
			e = s.T[0][j]
			x,y = s.position[e]
			if x==0:
				if y==j: continue
				if j!=0:
					s.buffer += [f"D{y}"]
					x,y = s.update(e)
			shift = y-j
			s.buffer += [f"{'RL'[shift>0]}{x}"]*abs(shift)+[f"U{j}"]*x
			s.update()

		# solving next lines cycling though the grid till penultimate:
		for i in range(1,s.h-1):
			for j in range(s.w):
				e = s.T[i][j]
				x,y = s.position[e]
				if x==i:
					if y==j: continue
					if j!=0:
						s.buffer += [f"D{y}",f"L{(i+1)%s.h}",f"U{y}"]
						x,y = s.update(e)
				if y==j:
					s.buffer += [f"L{x}"]
					x,y = s.update(e)
				hshift = y-j
				vshift = x-i
				s.buffer += [f"D{j}"]*vshift+[f"{'RL'[hshift>0]}{x}"]*abs(hshift)+[f"U{j}"]*vshift
				s.update()

		# apply a last slide to have the first element
		# of the last row at the leftmost index
		s.buffer = [f"L{s.h-1}"]*s.position[s.T[-1][0]][1]
		s.update()

		# sorting the last row, by using a specific 'jump' movement, alternated with slides
		# the 'jump' takes the element at index -2 and brings it to the end of the array
		final = s.final_sort(s.B[-1],s.T[-1],rec)
		return None if final=='unsolvable' else s.moves

def loopover(mixed_up_board, solved_board,f=''):
    return Board(mixed_up_board,solved_board).solve()
