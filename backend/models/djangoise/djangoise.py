import typing
import inspect
from enum import Enum

from tortoise import filters as _tortoise_filters
from tortoise import models as _tortoise_models
from pypika.terms import ValueWrapper as _ValueWrapper

from pypika.enums import JSONOperators
from pypika.terms import BasicCriterion, Criterion, Term


def postgres_range_contains(field: Term, value: str) -> Criterion:
    return BasicCriterion(JSONOperators.CONTAINS, field, _Int8RangeValueWrapper(value))  # type: ignore


class _Int8RangeValueWrapper(_ValueWrapper):
    def __init__(self, value: typing.Any, alias: str | None = None) -> None:
        super().__init__(alias)
        self.value = value

    def get_value_sql(self, **kwargs) -> str:
        return f"({self.value.lower}::BIGINT)"


_old = _tortoise_filters.get_filters_for_field


def new_get_filters_for_field(
    field_name: str, field, source_field: str
) -> dict[str, dict]:
    if isinstance(field, BigIntegerRangeField):
        d = {
            f"{field_name}__contains": {
                "field": field_name,
                "source_field": source_field,
                "operator": postgres_range_contains,
            },
        }
        return d
    return _old(field_name, field, source_field)


_tortoise_filters.get_filters_for_field = new_get_filters_for_field
_tortoise_models.get_filters_for_field = new_get_filters_for_field  # type: ignore

from tortoise.models import Model as _Model, ModelMeta  # noqa: E402
from tortoise.fields import (  # noqa: E402
    ForeignKeyField as _ForeignKey,
    ManyToManyField as _ManyToManyField,
    CharField as _CharField,
    CharEnumField as _CharEnumField,
    Field as _Field,
    BigIntField as _BigIntField,
    UUIDField as _UUIDField,
)
from asyncpg.types import Range as _Range  # noqa: E402


_MODELS_PREFIX = "models."


class BigIntegerRangeField(_Field, _Range):
    SQL_TYPE = "int8range"
    indexable = True

    class _db_postgres:
        SQL_TYPE = "int8range"


class _DjangoiseModelMeta(ModelMeta):
    def __new__(mcs, name: str, bases: typing.Tuple[typing.Type], attrs: dict):
        attrs = {**attrs}
        try:
            Meta: type = attrs["Meta"]
        except KeyError:
            pass
        else:
            try:
                table_name = getattr(Meta, "db_table")
            except AttributeError:
                pass
            else:
                setattr(Meta, "table", table_name)
        return super().__new__(mcs, name, bases, attrs)


class Model(_Model, metaclass=_DjangoiseModelMeta):
    pass


M: typing.TypeAlias = type[Model] | type[_Model] | str


def _modelname(m: M):
    model_name = m if isinstance(m, str) else m.__name__
    if not model_name.startswith(_MODELS_PREFIX):
        model_name = f"{_MODELS_PREFIX}{model_name}"
    return model_name


class TextChoices(Enum):
    def __new__(cls, *args):
        obj = object.__new__(cls)
        obj._value_ = args[0]
        return obj

    @classmethod
    def __init_subclass__(cls):
        cls.choices = cls


def CharField(
    *,
    choices: type[Enum] | None = None,
    default: typing.Any | None = None,
    blank: bool = False,
    null: bool = False,
    db_index: bool = False,
    unique: bool = False,
    max_length: int,
):
    if choices is None:
        return _CharField(
            blank=blank, null=null, max_length=max_length, default=default
        )
    else:
        return _CharEnumField(
            choices,
            blank=blank,
            null=null,
            max_length=max_length,
            default=default,
        )


def ForeignKey(
    to: M,
    on_delete: typing.Literal["RESTRICT", "SET NULL", "SET_DEFAULT", "CASCADE"],
    *,
    related_name: str | None = None,
    related_query_name: str | None = None,  # skip
    blank: bool = False,
    null: bool = False,
):
    return _ForeignKey(
        _modelname(to),
        related_name=related_name,
        on_delete=on_delete,
        blank=blank,
        null=null,
    )


def ManyToManyField(
    to: M,
    *,
    db_table: str,
    related_name: str = "",
    related_query_name: str = "",
    **kwargs,
):
    if isinstance(to, str):
        forward_key = f"{to.split('.')[-1].lower()}_id"
    else:
        forward_key = f"{to.__name__.lower()}_id"

    through = db_table
    stack = inspect.stack(1)
    self_name: str = stack[1].frame.f_locals["__qualname__"].split(".")[-1]
    backward_key = f"{self_name.lower()}_id"

    return _ManyToManyField(
        _modelname(to),
        through=through,
        forward_key=forward_key,
        backward_key=backward_key,
        related_name=related_name,
        **kwargs,
    )


def BigIntegerField(
    *,
    primary_key: bool = False,
    max_length: int | None = None,
    unique: bool = False,
    blank: bool = False,
    null: bool = False,
    db_index: bool = False,
    default: int | None = None,
):
    return _BigIntField(
        pk=primary_key, default=default, null=null, blank=blank, unique=unique
    )


def UUIDField(
    *,
    primary_key: bool = False,
    null: bool = False,
    default: typing.Any | None = None,
    unique: bool = False,
    index: bool = False,
    description: str | None = None,
    **_kwargs,
):
    return _UUIDField(
        pk=primary_key,
        null=null,
        default=default,
        unique=unique,
        index=index,
        description=description,
    )


def BigAutoField(primary_key: bool | None):
    return _BigIntField(pk=primary_key, generated=True)
