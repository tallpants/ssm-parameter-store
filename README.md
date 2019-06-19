# `ssm-parameter-store`

A safer, nicer abstraction over AWS SSM Parameter Store with built-in caching and idempotent preloading.
TypeScript compile time checks, plus handy autocompletion:

![](docs/autocomplete-1.png)
![](docs/autocomplete-2.png)

## Installation

- `npm install --save ssm-parameter-store`

Or

- `yarn add ssm-parameter-store`

## Usage

```js
import AWS from 'aws-sdk';
import SsmParameterStore from './src';

AWS.config.update({ region: 'us-east-1' });

async function main() {
  const params = new SsmParameterStore({
    TestParameter: 'test_parameter',
    TestNestedParameter: '/this/is/a/test/nested/parameter',
    NonExistentParameter: 'doesntexist'
  });

  await params.preload();

  console.log(await params.getAll());
  // -> {
  //      TestParameter: '1',
  //      TestNestedParameter: 'Hello, World!',
  //      NonExistentParameter: undefined
  //    }

  console.log(await params.get('TestParameter')); // -> '1'
  console.log(await params.get('TestNestedParameter')); // -> 'Hello, World!'

  await params.preload(); // Resolves instantly since we already preloaded
  await params.preload({ ignoreCache: true }); // Force preloading everything again

  // Also updates the cache after fetching
  console.log(await params.get('NonExistentParameter', { ignoreCache: true })); // -> undefined

  console.log(await params.get('UndeclaredParameter'));
  // -> undefined (+ compile time error!);
  // ts(2345) Argument of type '"UndeclaredParameter"' is not assignable to parameter of type '"TestParameter" | "TestNestedParameter" | "NonExistentParameter"
}

main();
```
