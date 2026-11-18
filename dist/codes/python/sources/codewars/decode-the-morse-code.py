def decodeMorse(morseCode):
    phrase = []
    for word in list(w.split() for w in morseCode.split('   ')):
        mot=[]
        for c in word:
            mot.append(MORSE_CODE[c])
        phrase.append(''.join(mot))
    while phrase[0] == "":
        phrase.remove("")
    return " ".join(phrase)