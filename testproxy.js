var spawn = require('child_process').spawn,
py    = spawn('python', ['dfa.py']),
data = getRandomNumberBetween(2300,0,10),
dataString = '';

/*Here we are saying that every time our node application receives data from the python process output stream(on 'data'), we want to convert that received data into a string and append it to the overall dataString.*/
py.stdout.on('data', function(data){
    dataString += data.toString();
  });
  
/*Once the stream is done (on 'end') we want to simply log the received data to the console.*/
py.stdout.on('end', function(){
    console.log('Alpha Component =',dataString);
});

/*We have to stringify the data first otherwise our python process wont recognize it*/
py.stdin.write(JSON.stringify(data));

py.stdin.end();

function getRandomNumberBetween(number,min,max){
  if (!min) min = 0
  if (!max) max = 1
  if (!number) number = 1

  let random_array = []
  let i = 0

  while (i < number) {
    random_array.push(Math.random()*(max-min+1)+min)
    i++
  }

  return random_array;

}