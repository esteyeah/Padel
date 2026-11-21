// Version site : les musiques NCS sont des fichiers séparés (public/music/), en qualité normale.
const T = [['Aditya Sharma', 'Bad Idea'], ['BEKSY.', 'Stars in the Sky'], ['Cartoon', 'On & On (feat. Daniel Levi)'], ['Daniel Levi', 'Getaway'], ['Daniel Levi', 'Honey'], ['Diviners', 'Savannah (feat. Philly K)'], ['Narvent & Axstin', 'Cloud 9'], ['OSKI', 'Stay The Night']];
export default T.map(([artist, title], i) => ({ artist, title, url: `music/t${i}.mp3` }));
