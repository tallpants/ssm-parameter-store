import AWS from 'aws-sdk';
import SsmParameterStore from './src';

AWS.config.update({ region: 'us-east-1' });

async function main() {
  const params = new SsmParameterStore({
    AmbassadorIsSandbox: 'ambassador_is_sandbox',
    TestNestedParameter: '/this/is/a/test/nested/parameter',
    NonExistentParameter: 'doesntexist'
  });

  await params.preload();

  console.log(await params.getAll());
  // -> { AmbassadorIsSandbox: '1',
  //      TestNestedParameter: 'Hello, World!',
  //      NonExistentParameter: undefined
  //    }

  console.log(await params.get('AmbassadorIsSandbox')); // -> '1'
  console.log(await params.get('TestNestedParameter')); // -> 'Hello, World!'

  await params.preload(); // Resolves instantly since we already preloaded
  await params.preload({ ignoreCache: true }); // Force preloading everything again

  // Also updates the cache after fetching
  console.log(await params.get('NonExistentParameter', { ignoreCache: true })); // -> undefined

  // console.log(await params.get('UndeclaredParameter')); // -> undefined (+ compile time error!);
}

main();
