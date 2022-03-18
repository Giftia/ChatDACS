module.exports = {
  插件名: "连通性与跑分测试插件", //插件名，仅在插件加载时展示
  指令: "^[/!]ping", //指令触发关键词，可使用正则表达式匹配
  版本: "1.1", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "PingPong，最基础的插件，可基于本插件学习插件的开发", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    //插件的功能实现，将会传入 消息全文 msg、qq号 qNum、qq群号 gNum 以供使用，处理完成后需要return结果，若无需回复则 return "";
    //这里实现了一个简单的Pong响应和圆周率跑分

    let runtime = process.hrtime(),
      final = "";

    //
    // arctangent series for Pi a la mode by Bohr
    //
    var vectorsize = 53; // number of elements in each of four arrays
    var nCells = 52; // number of array elements displayed

    // constant
    var BASE = 10000.0; // The number base
    var TENTHOUSANDTH = 0.0001; // avoids floating point division
    var SQ_239E4 = 571210000.0; // = BASE x 239 squared
    var SQ_5E4 = 250000.0; // = BASE x 5 squared
    var REPAIR = 0.000005; // roundoff correction
    var RECIPR_25 = 0.04; // the reciprocal of 25 is 0.04
    var RECIPR_239 = 1.0 / 57121; // reciprocal of 239 squared

    // arrays
    var term5 = null; // = (1/5)^(2n+1), integer array
    var term239 = null; // = (1/239)^(2n+1), integer array
    var sum = null; // = 16term5-4term239, integer array
    var series = null; // = PI

    // floating or integer
    var TwoNplus1 = 1.0; // 2n+1 = 1,3,5,7,...
    var Basex2n_1 = BASE; // = 10000*(2n+1)
    var Currdigit = 1; // index of the series[] element being printed
    var sgn = 1; // = (-1)^n; takes the values -1 and 1

    function MakeArray(n) {
      this.length = n;
      for (var i = 1; i <= n; i++) {
        this[i] = 0;
      }
      return this;
    }
    function PiSetup() {
      term5 = new MakeArray(vectorsize);
      term239 = new MakeArray(vectorsize);
      sum = new MakeArray(vectorsize);
      series = new MakeArray(vectorsize);

      term5[1] = 5;
      term239[1] = 239;
    }
    function DivideTerms() {
      var total5 = term5[1];
      var total239 = term239[1];

      // Divide the terms by 25 or 57121
      for (var i = Currdigit; i <= nCells + 2; i++) {
        term5[i] = Math.floor(RECIPR_25 * total5 + REPAIR);
        total5 = BASE * total5 - SQ_5E4 * term5[i] + term5[i + 1];
        term239[i] = Math.floor(total239 * RECIPR_239 + REPAIR);
        total239 = BASE * total239 - SQ_239E4 * term239[i] + term239[i + 1];
      }
    }
    function SubtractTerms() {
      var carry = 0;
      var total = 0;

      for (var i = nCells + 1; i > Currdigit; i--) {
        total = 16.0 * term5[i] - 4.0 * term239[i] + carry + 60000.0;
        carry = Math.floor(total * TENTHOUSANDTH + REPAIR) - 6.0;
        sum[i] = Math.floor(total - BASE * carry - 60000.0);
      }
    }
    function DivideSum() {
      var total = sum[1];
      var reciprocal = 1.0 / TwoNplus1;

      for (var i = Currdigit; i <= nCells + 2; i++) {
        sum[i] = Math.floor(total * reciprocal + REPAIR);
        total = BASE * total - Basex2n_1 * sum[i] + sum[i + 1];
      }
    }
    function AddShowDigits() {
      var i = 0;
      var total = 0;
      var carry = 0;
      var strg = "x";
      var old1 = series[Currdigit + 1];
      var old2 = series[Currdigit + 2];

      // Add the sum to the series
      for (i = nCells + 1; i >= Currdigit; i--) {
        total = series[i] + sgn * sum[i] + carry + 30000.0;
        carry = Math.floor(total * TENTHOUSANDTH + REPAIR) - 3.0;
        series[i] = Math.floor(total - BASE * carry - 30000.0);
      }

      // if stable, display digits
      if (old1 == series[Currdigit + 1] && old2 == series[Currdigit + 2]) {
        Currdigit++;
        strg = BASE + series[Currdigit] + " ";
        final += strg.substring(1, 5);
      }
    }

    function Crunch() {
      while (Currdigit < nCells) {
        DivideTerms();
        SubtractTerms();
        DivideSum();
        AddShowDigits();

        // Set up the next value of n
        TwoNplus1 += 2.0;
        Basex2n_1 = BASE * TwoNplus1;
        sgn = 0 - sgn;
      }
    }

    PiSetup();

    Crunch();

    runtime = process.hrtime(runtime)[1] / 1000 / 1000;

    return { type: "text", content: `Pong! 3.${final} in ${runtime}ms` };
  },
};
