List<Map<String, dynamic>> _mapList(Object? value) => value is List
    ? value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList()
    : const [];

class AssistantBootstrap {
  const AssistantBootstrap({
    required this.canUse,
    required this.credits,
    required this.profileDefaults,
    required this.documents,
    required this.workflows,
    required this.tools,
    required this.dynamicOptions,
  });
  final bool canUse;
  final int credits;
  final Map<String, String> profileDefaults;
  final List<AssistantDocument> documents;
  final List<AssistantWorkflow> workflows;
  final List<AssistantTool> tools;
  final Map<String, Map<String, List<AssistantOption>>> dynamicOptions;

  factory AssistantBootstrap.fromJson(Map<String, dynamic> json) =>
      AssistantBootstrap(
        canUse: json['canUseAssistant'] != false,
        credits: (json['creditsRemaining'] as num?)?.toInt() ?? 0,
        profileDefaults: (json['profileDefaults'] as Map? ?? {}).map(
          (key, value) => MapEntry(key.toString(), value?.toString() ?? ''),
        ),
        documents: _mapList(
          json['documents'],
        ).map(AssistantDocument.fromJson).toList(),
        workflows: _mapList(
          json['workflows'],
        ).map(AssistantWorkflow.fromJson).toList(),
        tools: _mapList(json['tools']).map(AssistantTool.fromJson).toList(),
        dynamicOptions: _parseDynamicOptions(json['dynamicOptions']),
      );
}

Map<String, Map<String, List<AssistantOption>>> _parseDynamicOptions(
  Object? raw,
) {
  if (raw is! Map) return const {};
  return raw.map((source, groups) {
    final parsedGroups = groups is Map
        ? groups.map(
            (key, options) => MapEntry(
              key.toString(),
              _mapList(options).map(AssistantOption.fromJson).toList(),
            ),
          )
        : <String, List<AssistantOption>>{};
    return MapEntry(source.toString(), parsedGroups);
  });
}

class AssistantDocument {
  const AssistantDocument({
    required this.id,
    required this.title,
    required this.toolSlug,
    required this.status,
  });
  final String id;
  final String title;
  final String toolSlug;
  final String status;

  factory AssistantDocument.fromJson(Map<String, dynamic> json) =>
      AssistantDocument(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? 'Dokumen',
        toolSlug: json['toolSlug']?.toString() ?? '',
        status: json['status']?.toString() ?? 'DRAFT',
      );
}

class AssistantWorkflow {
  const AssistantWorkflow({
    required this.id,
    required this.title,
    required this.description,
    required this.goal,
    required this.items,
  });
  final String id;
  final String title;
  final String description;
  final String goal;
  final List<AssistantWorkflowItem> items;

  factory AssistantWorkflow.fromJson(Map<String, dynamic> json) =>
      AssistantWorkflow(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? 'Workflow',
        description: json['description']?.toString() ?? '',
        goal: json['goal']?.toString() ?? '',
        items: _mapList(
          json['items'],
        ).map(AssistantWorkflowItem.fromJson).toList(),
      );
}

class AssistantWorkflowItem {
  const AssistantWorkflowItem({
    required this.note,
    required this.required,
    required this.tool,
  });
  final String note;
  final bool required;
  final AssistantTool tool;

  factory AssistantWorkflowItem.fromJson(Map<String, dynamic> json) =>
      AssistantWorkflowItem(
        note: json['note']?.toString() ?? '',
        required: json['required'] == true,
        tool: AssistantTool.fromJson(
          Map<String, dynamic>.from(json['tool'] as Map? ?? {}),
        ),
      );
}

class AssistantTool {
  const AssistantTool({
    required this.slug,
    required this.name,
    required this.description,
    required this.creditCost,
    required this.steps,
  });
  final String slug;
  final String name;
  final String description;
  final int creditCost;
  final List<AssistantFormStep> steps;

  factory AssistantTool.fromJson(Map<String, dynamic> json) => AssistantTool(
    slug: json['slug']?.toString() ?? '',
    name: json['name']?.toString() ?? 'Generator',
    description: json['description']?.toString() ?? '',
    creditCost: (json['creditCost'] as num?)?.toInt() ?? 0,
    steps: _mapList(json['formSteps']).map(AssistantFormStep.fromJson).toList(),
  );
}

class AssistantFormStep {
  const AssistantFormStep({
    required this.id,
    required this.label,
    required this.fields,
  });
  final String id;
  final String label;
  final List<AssistantFormField> fields;

  factory AssistantFormStep.fromJson(Map<String, dynamic> json) =>
      AssistantFormStep(
        id: json['id']?.toString() ?? '',
        label: json['label']?.toString() ?? 'Data',
        fields: _mapList(
          json['fields'],
        ).map(AssistantFormField.fromJson).toList(),
      );
}

class AssistantFormField {
  const AssistantFormField({
    required this.name,
    required this.label,
    required this.type,
    required this.required,
    required this.options,
    this.placeholder,
    this.optionsSource,
    this.dependsOn,
  });
  final String name;
  final String label;
  final String type;
  final bool required;
  final String? placeholder;
  final String? optionsSource;
  final String? dependsOn;
  final List<AssistantOption> options;

  factory AssistantFormField.fromJson(Map<String, dynamic> json) =>
      AssistantFormField(
        name: json['name']?.toString() ?? '',
        label: json['label']?.toString() ?? 'Isian',
        type: json['type']?.toString() ?? 'text',
        required: json['required'] == true,
        placeholder: json['placeholder']?.toString(),
        optionsSource: json['optionsSource']?.toString(),
        dependsOn: json['dependsOn']?.toString(),
        options: _mapList(
          json['options'],
        ).map(AssistantOption.fromJson).toList(),
      );
}

class AssistantOption {
  const AssistantOption(this.value, this.label);
  final String value;
  final String label;
  factory AssistantOption.fromJson(Map<String, dynamic> json) =>
      AssistantOption(
        json['value']?.toString() ?? '',
        json['label']?.toString() ?? '',
      );
}
