def top_3_words(t):

	abcdef = {chr(i)for i in range(97,123)}|{"'"}
	words,word,top = {},"",[]

	for i,c in enumerate(t+' '):
		c = c.lower()
		if c in abcdef: word += c
		else:
			if word and set(word)!={"'"}:
				n = words.get(word,0)+1
				words[word] = n
				if word not in top:
					lower_top = words[top[-1]] if top else 0
					if n>=lower_top or len(top)<3: top += [word]
				top = sorted(top,key=lambda x:words[x],reverse=1)[:3] 
			word = ""
            
	return top