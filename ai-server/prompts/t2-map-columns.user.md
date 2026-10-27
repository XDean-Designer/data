# T2 · 列名映射（user prompt）

> 占位符由 `src/llm.py` 注入。保持简短——长内容一律放 system 前缀，便于命中 DeepSeek 前缀缓存。

```
目标类别：{{TARGET_LABEL}}（{{TARGET_KEY}}）
工作表：{{SHEET_NAME}}
该表共 {{COL_COUNT}} 列。表头与每列前 {{SAMPLE_N}} 行样本如下（制表符分隔，空值记为 ␀）：

{{COLUMN_TABLE}}

请只输出一个 json 对象，不要任何额外文字。
```
