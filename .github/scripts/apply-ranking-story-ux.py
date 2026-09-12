from pathlib import Path

path = Path('app/components/game-stories.tsx')
text = path.read_text()
text = text.replace(
    'import { Form, useNavigation, useSubmit } from "react-router";',
    'import { Form, useActionData, useNavigation, useSubmit } from "react-router";'
)
text = text.replace(
    '  const navigation = useNavigation();\n  const submit = useSubmit();\n  const dialogRef = useRef<HTMLDialogElement>(null);',
    '  const actionData = useActionData<{ error?: string }>();\n  const navigation = useNavigation();\n  const submit = useSubmit();\n  const dialogRef = useRef<HTMLDialogElement>(null);\n  const saveSubmissionRef = useRef(false);'
)
needle = '''  const isSaving =\n    navigation.state === "submitting" &&\n    navigation.formData?.get("intent") === "save-story-post";\n\n  useEffect(() => {\n    const dialog = dialogRef.current;'''
replacement = '''  const isSaving =\n    navigation.state === "submitting" &&\n    navigation.formData?.get("intent") === "save-story-post";\n\n  useEffect(() => {\n    if (isSaving) {\n      saveSubmissionRef.current = true;\n      return;\n    }\n    if (!saveSubmissionRef.current || navigation.state !== "idle") return;\n\n    saveSubmissionRef.current = false;\n    if (!actionData?.error) closeDialog();\n  }, [actionData, isSaving, navigation.state]);\n\n  useEffect(() => {\n    const dialog = dialogRef.current;'''
if needle not in text:
    raise SystemExit('story save effect insertion point not found')
text = text.replace(needle, replacement)
path.write_text(text)
