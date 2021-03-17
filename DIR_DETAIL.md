###### 引用自 https://github.com/liutao/vue2.0-source

```
|—  src 主要源码所在位置

    |— compiler 模板解析的相关文件

        |—codegen 根据ast生成render函数

        |—directives 通用生成render函数之前需要处理的指令

        |—parser 模板解析

    |—  core 核心代码

        |— components 全局的组件，这里只有keep-alive

        |— global-api 全局方法，也就是添加在Vue对象上的方法，比如Vue.use,Vue.extend,,Vue.mixin等

        |— instance 实例相关内容，包括实例方法，生命周期，事件等

        |— observer 双向数据绑定相关文件

        |— util 工具方法

        |— vdom 虚拟dom相关

    |— entries 入口文件，也就是build文件夹下config.js中配置的入口文件。看源码可以从这里看起

    |— platforms 平台相关的内容

        |— web web端独有文件

            |— compiler 编译阶段需要处理的指令和模块

            |— runtime 运行阶段需要处理的组件、指令和模块

            |— server 服务端渲染相关

            |— util 工具库

        |— weex weex端独有文件

    |— server 服务端渲染相关

    |— sfc

        |— parser.js 包含了单文件 Vue 组件 (*.vue) 的解析逻辑。在 vue-template-compiler 包中被使用。

    |—  shared 共享的工具方法
```
