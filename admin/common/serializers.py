import json
import uuid
import decimal
import datetime

from collections import OrderedDict
from collections.abc import Iterable
from rest_framework import serializers


def json_encode(obj):
    match obj:
        case decimal.Decimal():
            return float(obj)
        case datetime.time():
            return obj.strftime("%H:%M")
        case datetime.datetime() | datetime.date():
            return str(obj.strftime("%s"))
        case uuid.UUID():
            return str(obj)
        case float():
            return float(obj)
        case int():
            return int(obj)
        case dict():
            return OrderedDict(obj)
        case set():
            return list(obj)
        case list():
            return list(obj)
    return str(obj)


class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        return json_encode(obj)
        # return json.JSONEncoder.default(self, obj)


class SerializedView:
    @staticmethod
    def serialize_items(data, fields, without_null=False):
        if isinstance(data, Iterable):
            items, data = list(data), []
            for item in items:
                if not isinstance(item, dict):
                    item = SerializedView.serialize_item(item, fields, without_null)
                data.append(item)
        return data

    @staticmethod
    def serialize_item(item, fields, without_null=False):
        obj = {}
        for field in fields:
            if isinstance(field, dict):
                for nest, nest_fields in field.items():
                    alias, attr = SerializedView.get_item_attr(item, nest)
                    if attr is None and without_null:
                        continue
                    if isinstance(attr, Iterable):
                        obj[alias] = SerializedView.serialize_items(
                            attr, nest_fields, without_null=False
                        )
                    else:
                        obj[alias] = SerializedView.serialize_item(
                            attr, nest_fields, without_null=False
                        )
                continue
            alias, attr = SerializedView.get_item_attr(item, field)
            if attr is None and without_null:
                continue
            obj[alias] = json_encode(attr)
        return obj

    @staticmethod
    def get_item_attr(item, field):
        alias = field
        if ":" in field:
            parts = field.split(":")
            field = parts[0]
            alias = parts[1]
        attr = item
        for a in field.split("__"):
            attr = getattr(attr, a, None)
            if callable(attr):
                if hasattr(attr, "all") and callable(getattr(attr, "all")):
                    attr = getattr(attr, "all")()
                else:
                    attr = attr()
        return (alias, attr)
