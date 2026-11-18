def count_patterns_from(firstPoint, length):
  if length in [0,1]: return length
  nextPoints = {'A':['BC','F','EI','H','DG'],
                'B':['C','F','I','EH','G','D','A'],
                'C':['FI','H','EG','D','BA'],
                'D':['A','B','C','EF','I','H','G'],
                'E':['A','B','C','F','I','H','G','D'],
                'F':['C','B','A','ED','G','H','I'],
                'G':['DA','B','EC','F','HI'],
                'H':['G','D','A','EB','C','F','I'],
                'I':['HG','D','EA','B','FC']}
  patterns = [firstPoint]
  for i in range(length-1):
    temp = []
    for p in patterns:
      temp.extend([p+c for c in[next((i for i in g if i not in p),'') for g in nextPoints[p[-1]]]if c!=''])
    patterns = temp
  return len(patterns)