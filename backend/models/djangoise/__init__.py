"""
Интерфейсы у обеих ORMок почти одинаковые, но жопа подгорает каждый раз, когда
надо дублировать изменения из джанго моделек в черепаху.

Здесь собраны интерфейсы для копипасты моделей из джанги 1 к 1,
чтобы не переписывать каждый раз модели под tortoise.

Всего лишь вместо импорта из tortoise, берем нужные инструменты из этого модуля.
"""

from tortoise.fields import (
    TextField,
    IntField as IntegerField,
    DatetimeField as DateTimeField,
    JSONField,
    BooleanField,
    ReverseRelation as QuerySet,
    DecimalField,
    RESTRICT,
    CASCADE,
    SET_DEFAULT,
    SET_NULL,
)

from tortoise.transactions import atomic as db_transaction

from .djangoise import (
    Model,
    ForeignKey,
    ManyToManyField,
    TextChoices,
    CharField,
    BigIntegerRangeField,
    BigAutoField,
    BigIntegerField,
    UUIDField,
    EmailField,
    URLField,
    IntField,
    OneToOneField,
    PositiveIntegerField,
)


__all__ = [
    "Model",
    "TextField",
    "ForeignKey",
    "ManyToManyField",
    "TextChoices",
    "IntegerField",
    "UUIDField",
    "DateTimeField",
    "JSONField",
    "BooleanField",
    "QuerySet",
    "CharField",
    "CASCADE",
    "RESTRICT",
    "SET_DEFAULT",
    "SET_NULL",
    "BigIntegerRangeField",
    "DecimalField",
    "BigIntegerField",
    "BigAutoField",
    "EmailField",
    "URLField",
    "IntField",
    "OneToOneField",
    "PositiveIntegerField",
    "db_transaction",
]
