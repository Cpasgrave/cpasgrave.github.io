def alphametics(alphaM):

  # digits
  rg = range(10)

  # making input useable
  els, res = alphaM.replace(' ','').split('=')
  els = els.split("+")
  chars = [*set(alphaM)-{*'= +'}]
  lr = len(res)

  # storing first character for each line 
  # to avoid turning one of them into zero
  leading = {el[0] for el in els+[res]}

  # columns of added numbers, in reverse order
  # (to work from left to right)
  columns = [[els[j][-i-1] for j in range(len(els))if len(els[j])>i]for i in range(lr)]

  # reverse result line
  res_rev = res[::-1]

  # correspondance dictionary
  dic = {c:None for c in chars}

  # for each column, characters that have
  # not been seen yet in previous columns
  col_charsets = []
  for i in range(lr):
    prev = set().union(*col_charsets[:i])
    col_charsets.append(list({*columns[i],res_rev[i]}-prev))

  # Following are values that are
  # going to be dynamically updated

  # starting before first column
  col = -1
  # remaining digits
  remain = set(rg)
  # carry per column
  carry = [0]*lr
  # permutation generator for each column
  p_gen = [None]*lr
  
  # back flag
  back = 0

  while True:

    if not back:
      # stepping up to new column
      col += 1
      chars = col_charsets[col]
      p_gen[col] = perm(remain,len(chars))

    # new permutation applied
    p = next(p_gen[col],None)
    if p==None:
      # all permutations have been tried,
      # back to previous column
      col -= 1
      remain |= set([dic[c] for c in col_charsets[col]])
      back = 1
      continue

    # applying permutation
    leading_zero = 0
    for i,c in enumerate(col_charsets[col]):
      pi = p[i]
      if pi==0 and c in leading:
        leading_zero = 1
        back = 1
        break
      dic[c] = pi
    if leading_zero: continue

    back = 0
    # checking the column's sum
    s = sum([dic[c]for c in columns[col]]) + carry[col]
    if s%10 == dic[res_rev[col]]:
      # permutations fits till here
      if col == lr-1:
        if s//10:
          # shouldn't be a carry at last column:
          back = 1
          continue
        else:
          # solved
          break
      # up to next column
      carry[col+1] = s//10
      # digits used for this column 
      # won't be available
      remain -= {*p}

    else:
      # sum of column and result line
      # digit don't fit
      back = 1

  sol = ''.join([str(dic[a])if a in dic else a for a in alphaM])
  return sol

def perm(iterable, r=None):
    pool = tuple(iterable)
    n = len(pool)
    r = n if r is None else r
    if r > n: return
    indices = list(range(n))
    cycles = list(range(n, n-r, -1))
    yield tuple(pool[i] for i in indices[:r])
    while n:
        for i in reversed(range(r)):
            cycles[i] -= 1
            if cycles[i] == 0:
                indices[i:] = indices[i+1:] + indices[i:i+1]
                cycles[i] = n - i
            else:
                j = cycles[i]
                indices[i], indices[-j] = indices[-j], indices[i]
                yield tuple(pool[i] for i in indices[:r])
                break
        else: return