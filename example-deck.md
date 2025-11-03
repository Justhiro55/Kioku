# JavaScript ES6+ Fundamentals

## const
再代入不可の定数宣言。ブロックスコープを持つ。
- Tags: es6, variable, syntax

```javascript
const PI = 3.14159;
// PI = 3.14; // Error: Assignment to constant variable
```

## let
ブロックスコープの変数宣言。再代入可能。
- Tags: es6, variable, syntax

```javascript
let count = 0;
count = 1; // OK
```

## var
関数スコープの変数宣言。ES6以降は使用を避けるべき。
- Tags: legacy, variable, syntax

## Promise
非同期処理を扱うオブジェクト。resolve/rejectの2つの状態を持つ。
- Tags: async, es6

```javascript
const promise = new Promise((resolve, reject) => {
  setTimeout(() => resolve('Done!'), 1000);
});

promise.then(result => console.log(result));
```

## async/await
Promiseをより読みやすく書くための構文糖衣。
- Tags: async, es7

```javascript
async function fetchData() {
  const response = await fetch('/api/data');
  const data = await response.json();
  return data;
}
```

## Arrow Function
簡潔な関数定義。thisを束縛しない。
- Tags: es6, function, syntax

```javascript
// Traditional function
function add(a, b) {
  return a + b;
}

// Arrow function
const add = (a, b) => a + b;
```

## Destructuring
配列やオブジェクトから値を取り出す構文。
- Tags: es6, syntax

```javascript
// Array destructuring
const [first, second] = [1, 2, 3];

// Object destructuring
const { name, age } = { name: 'Alice', age: 25 };
```

## Spread Operator
配列やオブジェクトを展開する演算子(...)。
- Tags: es6, syntax

```javascript
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5]; // [1, 2, 3, 4, 5]

const obj1 = { a: 1, b: 2 };
const obj2 = { ...obj1, c: 3 }; // { a: 1, b: 2, c: 3 }
```

## Template Literals
バッククォートで囲んだ文字列。変数埋め込みや改行が可能。
- Tags: es6, string, syntax

```javascript
const name = 'World';
const greeting = `Hello, ${name}!`;
console.log(greeting); // "Hello, World!"
```

## Map
キーと値のペアを保持するコレクション。オブジェクトより柔軟。
- Tags: es6, data-structure

```javascript
const map = new Map();
map.set('key1', 'value1');
map.set('key2', 'value2');
console.log(map.get('key1')); // "value1"
```

## Set
重複のない値のコレクション。配列の重複削除に便利。
- Tags: es6, data-structure

```javascript
const set = new Set([1, 2, 2, 3, 3, 3]);
console.log([...set]); // [1, 2, 3]
```

## Class
オブジェクト指向プログラミングのためのクラス構文。
- Tags: es6, oop, syntax

```javascript
class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }

  greet() {
    return `Hello, I'm ${this.name}`;
  }
}

const alice = new Person('Alice', 25);
```

## Module (import/export)
コードをモジュールとして分割・再利用するための仕組み。
- Tags: es6, modules

```javascript
// math.js
export const add = (a, b) => a + b;
export const multiply = (a, b) => a * b;

// main.js
import { add, multiply } from './math.js';
```

## Optional Chaining
存在しないプロパティへの安全なアクセス。undefined回避。
- Tags: es2020, syntax

```javascript
const user = { name: 'Alice' };
console.log(user?.address?.city); // undefined (エラーにならない)
```

## Nullish Coalescing
null/undefinedのみをチェックする演算子(??)。
- Tags: es2020, syntax

```javascript
const value = null ?? 'default'; // 'default'
const zero = 0 ?? 'default'; // 0 (falsy だが null/undefined ではない)
```
