var spawn = require('child_process').spawn,
py    = spawn('python', ['compute_input.py']),
data = [1,2,3,4,5,6,7,8,9],
dataString = '';

/*Here we are saying that every time our node application receives data from the python process output stream(on 'data'), we want to convert that received data into a string and append it to the overall dataString.*/
py.stdout.on('data', function(data){
    dataString += data.toString();
  });
  
/*Once the stream is done (on 'end') we want to simply log the received data to the console.*/
py.stdout.on('end', function(){
    console.log('Sum of numbers=',dataString);
});

/*We have to stringify the data first otherwise our python process wont recognize it*/
py.stdin.write(JSON.stringify(data));

py.stdin.end();