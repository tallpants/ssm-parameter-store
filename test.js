const AWS = require('aws-sdk');
const SsmParameterStore = require('./src');

AWS.config.update({ region: 'us-east-1' });

async function main() {
  const params = new SsmParameterStore({
    TestParameter: 'test_parameter',
    TestNestedParameter: '/this/is/a/test/nested/parameter',
    NonExistentParameter: 'doesntexist'
  });

  console.log(await params.get('NonExistentParameter'));
  console.log(await params.get('TestNestedParameter'));
}

main();
