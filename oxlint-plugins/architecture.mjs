const FUNCTION_EXPRESSIONS = new Set(['ArrowFunctionExpression', 'FunctionExpression'])

function declarationOf(statement) {
  const isExport = statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
  return isExport ? statement.declaration : statement
}

function topLevelFunctions(statement) {
  const declaration = declarationOf(statement)
  if (declaration?.type === 'FunctionDeclaration') return [declaration]
  if (declaration?.type !== 'VariableDeclaration') return []
  return declaration.declarations.filter(declarator => FUNCTION_EXPRESSIONS.has(declarator.init?.type))
}

function isUtilsModule(filename) {
  return /[\\/]utils[\\/]/.test(filename) || filename.endsWith('.d.ts')
}

const classFirst = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Behaviour lives in classes; pure helpers live in a utils/ module.' },
  },
  create(context) {
    if (isUtilsModule(context.filename)) return {}
    return {
      Program(program) {
        for (const node of program.body.flatMap(topLevelFunctions)) {
          context.report({
            node,
            message: 'Top-level functions belong in a class, or in a utils/ module when they are pure helpers.',
          })
        }
      },
    }
  },
}

export default {
  meta: { name: 'architecture' },
  rules: { 'class-first': classFirst },
}
